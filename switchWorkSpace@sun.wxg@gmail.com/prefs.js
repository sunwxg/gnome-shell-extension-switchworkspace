import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const SCHEMA_NAME = 'org.gnome.shell.extensions.switchWorkSpace';
const SETTING_KEY_SWITCH_WORKSPACE = 'switch-workspace';
const SETTING_KEY_SWITCH_WORKSPACE_BACKWARD = 'switch-workspace-backward';
const SETTING_KEY_HIDE_EMPTY = 'hide-empty';
const SETTING_KEY_HIDE_WORKSPACE_NUMBER = 'hide-workspace-number';
const SETTING_KEY_WORKSPACE_NAME = {
       1 : 'workspace1-name',
       2 : 'workspace2-name',
       3 : 'workspace3-name',
       4 : 'workspace4-name',
      };

function buildPrefsWidget(settings, dir) {
    let frame = new Frame(settings, dir);
    return frame.widget;
}

var Frame = class Frame {
    constructor(settings, dir) {
        this._settings = settings;
        this._builder = new Gtk.Builder();
        this._builder.add_from_file(dir.get_path() + '/Frame.ui');

        this.widget = this._builder.get_object('settings_notebook');

        this.desktopSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.wm.keybindings' });

        let bindings_box = this._builder.get_object('key_bindings');
        bindings_box.append(this.keybindingBox());

        this.hideEmptyWorkspace();
        this.hideWorkspaceNumber();

        for (let i in SETTING_KEY_WORKSPACE_NAME) {
            this.workspaceNameBinding(i);
        }
    }

    workspaceNameBinding(index) {
        let workspace = this._builder.get_object(SETTING_KEY_WORKSPACE_NAME[index]);
        workspace.set_text(this._settings.get_string(SETTING_KEY_WORKSPACE_NAME[index]));
        workspace.connect('changed', (entry) => {
            this._settings.set_string(SETTING_KEY_WORKSPACE_NAME[index], entry.get_text()); });
    }

    hideEmptyWorkspace() {
        let button = this._builder.get_object('hide_empty_workspace');
        button.active = this._settings.get_boolean(SETTING_KEY_HIDE_EMPTY);
        button.connect('notify::active', (button) => {
            this._settings.set_boolean(SETTING_KEY_HIDE_EMPTY, button.active); });
    }

    hideWorkspaceNumber() {
        let button = this._builder.get_object('hide_workspace_number');
        button.active = this._settings.get_boolean(SETTING_KEY_HIDE_WORKSPACE_NUMBER);
        button.connect('notify::active', (button) => {
            this._settings.set_boolean(SETTING_KEY_HIDE_WORKSPACE_NUMBER, button.active); });
    }

    keybindingBox() {
        let box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
        let button1 = new Gtk.CheckButton({ label: 'Alt + `' });
        button1.key = '<Alt>Above_Tab';
        box.append(button1);

        let button2 = new Gtk.CheckButton({ group: button1,
                                            margin_start: 15,
                                            label: 'Super + `' });
        button2.key = '<Super>Above_Tab';
        box.append(button2);

        let button3 = new Gtk.CheckButton({ group: button1,
                                            margin_start: 15,
                                            label: 'Ctrl + `' });
        button3.key = '<Control>Above_Tab';
        box.append(button3);

        let button4 = new Gtk.CheckButton({ group: button1,
                                            margin_start: 15,
                                            label: 'Super + Tab' });
        button4.key = '<Super>Tab';
        box.append(button4);

        let [key] = this._settings.get_strv(SETTING_KEY_SWITCH_WORKSPACE);
        switch (key) {
        case '<Alt>Above_Tab':
            button1.set_active(true);
            break;
        case '<Super>Above_Tab':
            button2.set_active(true);
            break;
        case '<Control>Above_Tab':
            button3.set_active(true);
            break;
        case '<Super>Tab':
            button4.set_active(true);
            break;
        }

        button1.connect("toggled", (button) => { this.radioToggled(button); });
        button2.connect("toggled", (button) => { this.radioToggled(button); });
        button3.connect("toggled", (button) => { this.radioToggled(button); });
        button4.connect("toggled", (button) => { this.radioToggled(button); });

        return box;
    }

    radioToggled(button) {
        if (!(button.get_active()))
            return;

        this._settings.set_strv(SETTING_KEY_SWITCH_WORKSPACE, [button.key]);
        this._settings.set_strv(SETTING_KEY_SWITCH_WORKSPACE_BACKWARD, ['<Shift>' + button.key]);

        this.desktopSettings.reset('switch-group');
        this.desktopSettings.reset('switch-group-backward');
        this.desktopSettings.reset('switch-applications');
        this.desktopSettings.reset('switch-applications-backward');
        this.desktopSettings.reset('switch-windows');
        this.desktopSettings.reset('switch-windows-backward');

        switch (button.key) {
        case '<Alt>Above_Tab':
            this.desktopSettings.set_strv('switch-group', ['<Super>Above_Tab']);
            this.desktopSettings.set_strv('switch-group-backward', ['<Shift><Super>Above_Tab']);
            break;
        case '<Super>Above_Tab':
            this.desktopSettings.set_strv('switch-group', ['<Alt>Above_Tab']);
            this.desktopSettings.set_strv('switch-group-backward', ['<Shift><Alt>Above_Tab']);
            break;
        case '<Super>Tab':
            this.desktopSettings.set_strv('switch-applications', ['<Alt>Tab']);
            this.desktopSettings.set_strv('switch-applications-backward', ['<Shift><Alt>Tab']);
            this.desktopSettings.set_strv('switch-windows', ['<Alt>Tab']);
            this.desktopSettings.set_strv('switch-windows-backward', ['<Shift><Alt>Tab']);
            break;
        case '<Control>Above_Tab':
            break;
        }
    }
};

export default class SwitchWorkspacePrefs extends ExtensionPreferences {
    getPreferencesWidget() {
        return buildPrefsWidget(this.getSettings(), this.dir);
    }
}
