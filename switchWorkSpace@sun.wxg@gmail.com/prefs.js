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

function init() {
    //Convenience.initTranslations();
}

function buildPrefsWidget() {
    let widget = new switchWorkSpaceWidget();
    widget.show_all();

    return widget;
}

function bindingAltAboveTab() {
    let settings = Convenience.getSettings(SCHEMA_NAME);
    let value = settings.get_strv(SETTING_KEY_SWITCH_WORKSPACE);
    if (value.length === 0 ) {
        settings.set_strv(SETTING_KEY_SWITCH_WORKSPACE, ['<Alt>Above_Tab']);
        removeAltAboveTab();
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
    settings.set_strv('switch-group', oldValue);
}

const switchWorkSpaceWidget = new Lang.Class({
    Name: 'switchWorkSpaceWidget',
    GTypeName: 'switchWorkSpaceWidget',
    Extends: Gtk.Grid,

    _init: function(params) {
        this.parent(params);

        this.margin = 10;
        this.row_spacing = 12;
        this.column_spacing = 18;
        this.column_homogeneous = false;
        this.row_homogeneous = false;
        this.orientation = Gtk.Orientation.VERTICAL;

        let label = new Gtk.Label({ label: 'Switch Workspace Keybinding', use_markup: true,
                                    halign: Gtk.Align.START });
        this.attach(label, 1, 1, 2, 1);

        this._settings = Convenience.getSettings(SCHEMA_NAME);

        let box = this.keybindingBox(this._settings);

        addKeybinding(box.model, this._settings, SETTING_KEY_SWITCH_WORKSPACE,
                        "switch workspace");

        this.attach(box, 1, 2, 2, 2);
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

function addKeybinding(model, settings, id, description) {
    let accelerator = settings.get_strv(id)[0];
    let [key, mods] = Gtk.accelerator_parse(settings.get_strv(id)[0]);

    let row = model.insert(100);
    model.set(row,
        [COLUMN_ID, COLUMN_DESCRIPTION, COLUMN_KEY, COLUMN_MODS],
        [id,        description,        key,        mods]);
}
