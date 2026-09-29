import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const SETTING_KEY_SWITCH_WORKSPACE = 'switch-workspace';
const SETTING_KEY_SWITCH_WORKSPACE_BACKWARD = 'switch-workspace-backward';
const SETTING_KEY_HIDE_EMPTY = 'hide-empty';
const SETTING_KEY_HIDE_WORKSPACE_NUMBER = 'hide-workspace-number';
const SETTING_KEY_WORKSPACE_NAME = {
    1: 'workspace1-name',
    2: 'workspace2-name',
    3: 'workspace3-name',
    4: 'workspace4-name',
};

class SwitchWorkspaceSettingsPage extends Adw.PreferencesPage {
    static {
        GObject.registerClass(this);
    }

    constructor(settings) {
        super({
            title: _('Settings'),
            icon_name: 'preferences-system-symbolic',
        });

        this._settings = settings;
        this._desktopSettings = new Gio.Settings({schema_id: 'org.gnome.desktop.wm.keybindings'});

        this._addKeybindingsGroup();
        this._addWorkspaceGroup();
        this._addWorkspaceNamesGroup();
    }

    _addKeybindingsGroup() {
        const keybindings = [
            {key: '<Alt>Above_Tab', label: _('Alt + `')},
            {key: '<Super>Above_Tab', label: _('Super + `')},
            {key: '<Control>Above_Tab', label: _('Ctrl + `')},
            {key: '<Super>Tab', label: _('Super + Tab')},
        ];

        const group = new Adw.PreferencesGroup({title: _('Switch Workspace Keybinding')});
        this.add(group);

        const [currentKey] = this._settings.get_strv(SETTING_KEY_SWITCH_WORKSPACE);
        const buttons = [];

        for (const {key, label} of keybindings) {
            const button = new Gtk.CheckButton({
                group: buttons[0] ?? null,
                valign: Gtk.Align.CENTER,
            });
            buttons.push(button);

            const row = new Adw.ActionRow({
                title: label,
                activatable_widget: button,
            });
            row.add_prefix(button);
            group.add(row);

            button.key = key;
            if (key === currentKey)
                button.set_active(true);
        }

        for (const button of buttons)
            button.connect('toggled', btn => this._radioToggled(btn));
    }

    _addWorkspaceGroup() {
        const group = new Adw.PreferencesGroup({title: _('Workspace')});
        this.add(group);

        const hideEmptyRow = new Adw.SwitchRow({title: _('Hide empty workspace')});
        this._settings.bind(SETTING_KEY_HIDE_EMPTY, hideEmptyRow, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        group.add(hideEmptyRow);

        const hideNumberRow = new Adw.SwitchRow({title: _('Hide workspace number')});
        this._settings.bind(SETTING_KEY_HIDE_WORKSPACE_NUMBER, hideNumberRow, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        group.add(hideNumberRow);
    }

    _addWorkspaceNamesGroup() {
        const group = new Adw.PreferencesGroup({title: _('Workspace Name')});
        this.add(group);

        for (const index of Object.keys(SETTING_KEY_WORKSPACE_NAME)) {
            const row = new Adw.EntryRow({
                title: _('Workspace %d').replace('%d', index),
            });
            this._settings.bind(SETTING_KEY_WORKSPACE_NAME[index], row, 'text',
                Gio.SettingsBindFlags.DEFAULT);
            group.add(row);
        }
    }

    _radioToggled(button) {
        if (!button.get_active())
            return;

        this._settings.set_strv(SETTING_KEY_SWITCH_WORKSPACE, [button.key]);
        this._settings.set_strv(SETTING_KEY_SWITCH_WORKSPACE_BACKWARD, ['<Shift>' + button.key]);

        this._desktopSettings.reset('switch-group');
        this._desktopSettings.reset('switch-group-backward');
        this._desktopSettings.reset('switch-applications');
        this._desktopSettings.reset('switch-applications-backward');
        this._desktopSettings.reset('switch-windows');
        this._desktopSettings.reset('switch-windows-backward');

        switch (button.key) {
        case '<Alt>Above_Tab':
            this._desktopSettings.set_strv('switch-group', ['<Super>Above_Tab']);
            this._desktopSettings.set_strv('switch-group-backward', ['<Shift><Super>Above_Tab']);
            break;
        case '<Super>Above_Tab':
            this._desktopSettings.set_strv('switch-group', ['<Alt>Above_Tab']);
            this._desktopSettings.set_strv('switch-group-backward', ['<Shift><Alt>Above_Tab']);
            break;
        case '<Super>Tab':
            this._desktopSettings.set_strv('switch-applications', ['<Alt>Tab']);
            this._desktopSettings.set_strv('switch-applications-backward', ['<Shift><Alt>Tab']);
            this._desktopSettings.set_strv('switch-windows', ['<Alt>Tab']);
            this._desktopSettings.set_strv('switch-windows-backward', ['<Shift><Alt>Tab']);
            break;
        case '<Control>Above_Tab':
            break;
        }
    }
}

class SwitchWorkspaceAboutPage extends Adw.PreferencesPage {
    static {
        GObject.registerClass(this);
    }

    constructor() {
        super({
            title: _('About'),
            icon_name: 'help-about-symbolic',
        });

        const group = new Adw.PreferencesGroup();
        this.add(group);

        group.add(new Adw.ActionRow({
            title: _('Created by'),
            subtitle: 'Xiaoguang Wang',
        }));

        group.add(this._linkRow(_('Email'), 'sun.wxg@gmail.com',
            'mailto:sun.wxg@gmail.com'));
        group.add(this._linkRow(_('GitHub'),
            'https://github.com/sunwxg/gnome-shell-extension-switchworkspace',
            'https://github.com/sunwxg/gnome-shell-extension-switchworkspace'));
    }

    _linkRow(title, subtitle, uri) {
        const row = new Adw.ActionRow({
            title,
            subtitle,
            activatable: true,
        });
        row.add_suffix(new Gtk.Image({icon_name: 'adw-external-link-symbolic'}));
        row.connect('activated', () => Gio.AppInfo.launch_default_for_uri(uri, null));
        return row;
    }
}

export default class SwitchWorkspacePrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window.add(new SwitchWorkspaceSettingsPage(settings));
        window.add(new SwitchWorkspaceAboutPage());
    }
}
