const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const COLUMN_ID          = 0;
const COLUMN_DESCRIPTION = 1;
const COLUMN_KEY         = 2;
const COLUMN_MODS        = 3;

const SCHEMA_NAME = 'org.gnome.shell.extensions.switchWorkSpace';
const SETTING_KEY_SWITCH_WORKSPACE = 'switch-workspace';
const SETTING_KEY_WORKSPACE_NAME = {
       1 : 'workspace1-name',
       2 : 'workspace2-name',
       3 : 'workspace3-name',
       4 : 'workspace4-name',
      };

function init() {
    //Convenience.initTranslations();
}

function buildPrefsWidget() {
    let frame = new Frame();
    frame.widget.show_all();

    return frame.widget;
}

const Frame = new Lang.Class({
    Name: 'Frame',

    _init: function() {
        this._builder = new Gtk.Builder();
        this._builder.add_from_file(Me.path + '/Frame.ui');

        this.widget = this._builder.get_object('settings_notebook');

        this._settings = Convenience.getSettings(SCHEMA_NAME);

        let bindings_box = this._builder.get_object('key_bindings');
        bindings_box.add(this.keybindingBox(this._settings));

        for (let i in SETTING_KEY_WORKSPACE_NAME) {
            this.workspaceNameBinding(i);
        }
    },

    workspaceNameBinding: function(index) {
        let workspace = this._builder.get_object(SETTING_KEY_WORKSPACE_NAME[index]);
        workspace.set_text(this._settings.get_string(SETTING_KEY_WORKSPACE_NAME[index]));
        workspace.connect('changed', (entry) => {
            this._settings.set_string(SETTING_KEY_WORKSPACE_NAME[index], entry.get_text()); });
    },

    keybindingBox: function(SettingsSchema) {
        let box = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL });
        let button1 = new Gtk.RadioButton({ label: 'Alt + `' });
        button1.key = '<Alt>Above_Tab';
        box.pack_start(button1, false, false, 0);

        let button2 = new Gtk.RadioButton({ group: button1,
                                            margin_left: 15,
                                            label: 'Super + `' });
        button2.key = '<Super>Above_Tab';
        box.pack_start(button2, false, false, 0);

        let button3 = new Gtk.RadioButton({ group: button1,
                                            margin_left: 15,
                                            label: 'Ctrl + `' });
        button3.key = '<Control>Above_Tab';
        box.pack_start(button3, false, false, 0);

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
        }

        button1.connect("toggled", Lang.bind(this, this.radioToggled))
        button2.connect("toggled", Lang.bind(this, this.radioToggled))
        button3.connect("toggled", Lang.bind(this, this.radioToggled))

        return box;
    },

    radioToggled: function(button) {
        if (button.get_active()) {
            this._settings.set_strv(SETTING_KEY_SWITCH_WORKSPACE, [button.key]);
        }
    },
});
