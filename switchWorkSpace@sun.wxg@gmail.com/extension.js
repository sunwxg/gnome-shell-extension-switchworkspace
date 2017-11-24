const Lang = imports.lang;
const Gio = imports.gi.Gio;
const Shell = imports.gi.Shell;
const GLib = imports.gi.GLib;
const Meta = imports.gi.Meta;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Gtk = imports.gi.Gtk;

const WindowManager = imports.ui.windowManager.WindowManager;
const Main = imports.ui.main;
const AltTab = imports.ui.altTab;
const SwitcherPopup = imports.ui.switcherPopup;
const WorkspaceThumbnail = imports.ui.workspaceThumbnail;
const Extension = imports.misc.extensionUtils.getCurrentExtension();

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Prefs = Me.imports.prefs;

const WINDOW_PREVIEW_SIZE = 128;
const APP_ICON_SIZE_SMALL = 48;

const SCHEMA_NAME = 'org.gnome.shell.extensions.switchWorkSpace';
const SETTING_KEY_SWITCH_WORKSPACE = 'switch-workspace';

const WorkSpace= new Lang.Class({
    Name: 'WorkSpace',

    _init : function() {
        this._shellwm =  global.window_manager;

        Prefs.bindingAltAboveTab();
        this.addKeybinding();
    },

    addKeybinding: function() {
        let settings = Convenience.getSettings(SCHEMA_NAME);
        let ModeType = Shell.hasOwnProperty('ActionMode') ?
                       Shell.ActionMode : Shell.KeyBindingMode;

        Main.wm.addKeybinding(SETTING_KEY_SWITCH_WORKSPACE,
                              settings,
                              Meta.KeyBindingFlags.NONE,
                              ModeType.ALL,
                              Lang.bind(this, this._switchWorkspace));
    },

    unbindingKey: function() {
        Main.wm.removeKeybinding(SETTING_KEY_SWITCH_WORKSPACE);
    },

    _switchWorkspace : function(display, screen, window, binding) {
        popupList.update();

        let tabPopup = new WorkSpacePopup();

        if (!tabPopup.show(binding.is_reversed(), binding.get_name(), binding.get_mask())) {
            tabPopup.destroy();
        }
    },

    destroy: function() {
        this.unbindingKey();
        Prefs.addAltAboveTab();
    }
});

const PopupList = new Lang.Class({
    Name: 'PopupList',

    _init : function() {
        this._popupList = [];
    },

    create: function() {
        let activeWs = global.screen.get_active_workspace();
        this._popupList.push(activeWs.index());

        for (let i = 0; i < global.screen.n_workspaces; i++) {
            if (i === activeWs.index())
                continue;
            this._popupList.push(i);
        }
        this._popupList.reverse();
    },

    update: function() {
        if (this._popupList.length === 0) {
            this.create();
        } else {
            let activeWs = global.screen.get_active_workspace();
            let activeWsIndex = activeWs.index();
            if (activeWsIndex != this._popupList[this._popupList.length - 1]) {
                this.moveToTop(activeWsIndex);
            }

            if (this._popupList.length > global.screen.n_workspaces) {
                let index = this._popupList.indexOf(global.screen.n_workspaces);
                if (index > -1) {
                    this._popupList.splice(index, 1);
                }
            }

            if (this._popupList.length < global.screen.n_workspaces) {
                this._popupList.reverse();
                this._popupList.push(global.screen.n_workspaces - 1);
                this._popupList.reverse();
            }
        }
    },

    moveToTop: function(workspaceIndex) {
        let index = this._popupList.indexOf(workspaceIndex);

        if (index > -1) {
            this._popupList.splice(index, 1);
        }

        this._popupList.push(workspaceIndex);
    },
});

const WorkSpacePopup = new Lang.Class({
    Name: 'WorkSpacePopup',
    Extends: SwitcherPopup.SwitcherPopup,

    _init: function() {
        this.parent();

        this._switcherList = new WorkSpaceList();
        this._items = this._switcherList.icons;
    },

    _keyPressHandler: function(keysym, action) {
        if (keysym == Clutter.Left)
            this._select(this._previous());
        else
            this._select(this._next());

        return Clutter.EVENT_STOP;
    },

    _finish: function() {
        Main.wm.actionMoveWorkspace(this._switcherList.selectWorkspaces[this._selectedIndex]);

        let activeWs = global.screen.get_active_workspace();
        popupList.moveToTop(activeWs.index());

        this.parent();
    }
});

const WorkSpaceList = new Lang.Class({
    Name: 'WorkSpaceList',
    Extends: SwitcherPopup.SwitcherList,

    _init : function() {
        this.parent(true);

        this._label = new St.Label({ x_align: Clutter.ActorAlign.CENTER,
                                     y_align: Clutter.ActorAlign.CENTER });
        this.actor.add_actor(this._label);

        this.icons = [];

        this.workspaces = this.getWorkSpace();
        this.selectWorkspaces = [];

        let popup = popupList._popupList.slice();
        for (let i = 0; i < global.screen.n_workspaces; i++) {
            let workspace_index = popup.pop();
            this.selectWorkspaces[i] = this.workspaces[workspace_index];

            let icon = new WindowIcon(Number(workspace_index));

            this.addItem(icon.actor, icon.label);
            this.icons.push(icon);
        }
    },

    getWorkSpace: function() {
        let activeWs = global.screen.get_active_workspace();
        let activeIndex = activeWs.index();
        let ws = [];

        ws[activeIndex] = activeWs;

        for (let i = activeIndex - 1; i >= 0; i--) {
            ws[i] = ws[i + 1].get_neighbor(Meta.MotionDirection.UP);
        }

        for (let i = activeIndex + 1; i < global.screen.n_workspaces; i++) {
            ws[i] = ws[i - 1].get_neighbor(Meta.MotionDirection.DOWN);
        }

        return ws;
    },

    _getPreferredHeight: function(actor, forWidth, alloc) {
        this.parent(actor, forWidth, alloc);

        let spacing = this.actor.get_theme_node().get_padding(St.Side.BOTTOM);

        alloc.min_size += spacing;
        alloc.natural_size += spacing;
    },

    _allocateTop: function(actor, box, flags) {
        let childBox = new Clutter.ActorBox();
        childBox.x1 = box.x1;
        childBox.x2 = box.x2;
        childBox.y2 = box.y2;
        childBox.y1 = childBox.y2 - this._label.height;
        this._label.allocate(childBox, flags);

        let spacing = this.actor.get_theme_node().get_padding(St.Side.BOTTOM);
        box.y2 -= this._label.height + spacing;
        this.parent(actor, box, flags);
    },

    highlight: function(index, justOutline) {
        this.parent(index, justOutline);

        this._label.set_text(index == -1 ? '' : this.icons[index].label.text);
    }
});

const WindowIcon = new Lang.Class({
    Name: 'WindowIcon',

    _init: function(workspace_index) {
        this.label = new St.Label({ text: "WorkSpace" + " " + String(workspace_index + 1) });

        this.actor = new St.BoxLayout({ style_class: 'alt-tab-app',
                                        vertical: true });

        this._icon = new St.Widget({ layout_manager: new Clutter.BinLayout() });

        this.actor.add(this._icon, { x_fill: false, y_fill: false});

        this._icon.destroy_all_children();

        this._porthole = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);

        let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        let windowSize = WINDOW_PREVIEW_SIZE * scaleFactor;

        let scale = Math.min(1.0, windowSize / this._porthole.width,
                                windowSize / this._porthole.height);

        let metaWorkspace = global.screen.get_workspace_by_index(workspace_index);
        let thumbnail = new WorkspaceThumbnail.WorkspaceThumbnail(metaWorkspace);
        thumbnail.actor.set_scale(scale, scale);

        let workspaceIcon = new St.Widget({ layout_manager: new Clutter.BinLayout() });

        workspaceIcon.add_actor(thumbnail.actor);
        if (this._porthole.width >= this._porthole.height)
            workspaceIcon.set_size(windowSize, windowSize * (this._porthole.height / this._porthole.width));
        else
            workspaceIcon.set_size(windowSize * (this._porthole.width / this._porthole.height), windowSize);

        this._icon.add_actor(workspaceIcon);

        this._icon.add_actor(this._createNumberIcon(workspace_index + 1));

        this._icon.set_size(windowSize, windowSize);
    },

    _createNumberIcon: function(number) {
        let icon = new St.Widget({ x_expand: true,
                                   y_expand: true,
                                   x_align:  Clutter.ActorAlign.END,
                                   y_align:  Clutter.ActorAlign.END });

        let box = new St.BoxLayout({ style_class: 'number-window',
                                     vertical: true });
        icon.add_actor(box);

        let label = new St.Label({ style_class: 'number-label',
                                   text: number.toString() });
        box.add(label);

        return icon;
    }
});

function init() {
}

let workspace;
let popupList;

function enable() {
    workspace = new WorkSpace();
    popupList = new PopupList();
}

function disable() {
    workspace.destroy();
}
