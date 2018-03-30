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
    let widget = frame.widget;
    widget.show_all();

    return widget;
}

const Frame = new Lang.Class({
    Name: 'Frame',

    _init: function() {
        this._builder = new Gtk.Builder();
        this._builder.add_from_file(Me.path + '/Frame.ui');

        this.widget = this._builder.get_object('settings_notebook');

        this._settings = Convenience.getSettings(SCHEMA_NAME);

        let bindings_box = this._builder.get_object('key_bindings');
        let box = this.keybindingBox(this._settings);
        bindings_box.add(box);

        addKeybinding(box.model, this._settings, SETTING_KEY_SWITCH_WORKSPACE,
                        "switch workspace");

        for (let i in SETTING_KEY_WORKSPACE_NAME) {
            let workspace = this._builder.get_object(SETTING_KEY_WORKSPACE_NAME[i]);
            workspace.set_text(this._settings.get_string(SETTING_KEY_WORKSPACE_NAME[i]));
            workspace.connect('changed', (entry) => {
                this._settings.set_string(SETTING_KEY_WORKSPACE_NAME[i], entry.get_text()); });
        }
    },

    keybindingBox: function(SettingsSchema) {
        let model = new Gtk.ListStore();

        model.set_column_types(
            [GObject.TYPE_STRING, // COLUMN_ID
                GObject.TYPE_STRING, // COLUMN_DESCRIPTION
                GObject.TYPE_INT,    // COLUMN_KEY
                GObject.TYPE_INT]);  // COLUMN_MODS

        let treeView = new Gtk.TreeView({model: model,
            headers_visible: false,
            hexpand: true
        });

        let column, renderer;

        renderer = new Gtk.CellRendererText();

        column = new Gtk.TreeViewColumn({expand: true});
        column.pack_start(renderer, true);
        column.add_attribute(renderer, "text", COLUMN_DESCRIPTION);

        treeView.append_column(column);

        renderer = new Gtk.CellRendererAccel();
        renderer.accel_mode = Gtk.CellRendererAccelMode.GTK;
        renderer.editable = true;

        renderer.connect("accel-edited",
            function (renderer, path, key, mods, hwCode) {
                let [ok, iter] = model.get_iter_from_string(path);
                if(!ok)
                    return;

                addAltAboveTab();

                // Update the UI.
                model.set(iter, [COLUMN_KEY, COLUMN_MODS], [key, mods]);

                // Update the stored setting.
                let id = model.get_value(iter, COLUMN_ID);
                let accelString = Gtk.accelerator_name(key, mods);
                SettingsSchema.set_strv(id, [accelString]);
            });

        renderer.connect("accel-cleared",
            function (renderer, path) {
                let [ok, iter] = model.get_iter_from_string(path);
                if(!ok)
                    return;

                // Update the UI.
                model.set(iter, [COLUMN_KEY, COLUMN_MODS], [0, 0]);

                // Update the stored setting.
                let id = model.get_value(iter, COLUMN_ID);
                SettingsSchema.set_strv(id, []);

                removeAltAboveTab();
                bindingAltAboveTab();
            });

        column = new Gtk.TreeViewColumn();
        column.pack_end(renderer, false);
        column.add_attribute(renderer, "accel-key", COLUMN_KEY);
        column.add_attribute(renderer, "accel-mods", COLUMN_MODS);

        treeView.append_column(column);

        return treeView;
    },
});

function bindingAltAboveTab() {
    let settings = Convenience.getSettings(SCHEMA_NAME);
    let value = settings.get_strv(SETTING_KEY_SWITCH_WORKSPACE);
    if (value.length === 0 ) {
        removeAltAboveTab();
        settings.set_strv(SETTING_KEY_SWITCH_WORKSPACE, ['<Alt>Above_Tab']);
    } else if (value[0] === '<Alt>Above_Tab') {
        removeAltAboveTab();
    } else if (value[0] === '<Alt>grave') {
        removeAltAboveTab();
    }
}

function removeAltAboveTab() {
    let settings = Convenience.getSettings('org.gnome.desktop.wm.keybindings');
    let oldValue = settings.get_strv('switch-group');
    let newValue = [];

    for (let i = 0; i < oldValue.length; i++) {
        if (oldValue[i] === '<Alt>Above_Tab')
            continue;
        newValue.push(oldValue[i]);
    }
    settings.set_strv('switch-group', newValue);
}

function addAltAboveTab() {
    let settings = Convenience.getSettings('org.gnome.desktop.wm.keybindings');
    let oldValue = settings.get_strv('switch-group');

    let included = false;
    for (let i = 0; i < oldValue.length; i++) {
        if (oldValue[i] === '<Alt>Above_Tab') {
            included = true;
            break;
        }
    }
    if (!included)
        oldValue.push('<Alt>Above_Tab');
    //settings.set_strv('switch-group', oldValue);
    settings.reset('switch-group');
}

function addKeybinding(model, settings, id, description) {
    let accelerator = settings.get_strv(id)[0];
    let [key, mods] = Gtk.accelerator_parse(settings.get_strv(id)[0]);

    let row = model.insert(100);
    model.set(row,
        [COLUMN_ID, COLUMN_DESCRIPTION, COLUMN_KEY, COLUMN_MODS],
        [id,        description,        key,        mods]);
}
