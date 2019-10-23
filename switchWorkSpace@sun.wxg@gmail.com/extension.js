const Lang = imports.lang;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
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

const WINDOW_PREVIEW_SIZE = 128;
const APP_ICON_SIZE_SMALL = 48;

const SCHEMA_NAME = 'org.gnome.shell.extensions.switchWorkSpace';
const SETTING_KEY_SWITCH_WORKSPACE = 'switch-workspace';
const SETTING_KEY_WORKSPACE_NAME = {
       1 : 'workspace1-name',
       2 : 'workspace2-name',
       3 : 'workspace3-name',
       4 : 'workspace4-name',
      };

var WorkSpace = class WorkSpace {
    constructor() {
        this._settings = Convenience.getSettings(SCHEMA_NAME);

        this.addKeybinding();

        this.workspaceName = [];
        this.workspaceNameBindingId = [];

        for (let i in SETTING_KEY_WORKSPACE_NAME) {
            this.workspaceNameBinding(i);
        }
    }

    workspaceNameBinding(index) {
        this.workspaceName[index] = this._settings.get_string(SETTING_KEY_WORKSPACE_NAME[index]);

        this.workspaceNameBindingId[index] = this._settings.connect('changed::' + SETTING_KEY_WORKSPACE_NAME[index],
            () => { this.workspaceName[index] = this._settings.get_string(SETTING_KEY_WORKSPACE_NAME[index]); });
    }

    workspaceNameUnBinding(index) {
        if (this.workspaceNameBindingId[index]) {
            this._settings.disconnect(this.workspaceNameBindingId[index]);
            this.workspaceNameBindingId[index] = null;
        }
    }

    addKeybinding() {
        let ModeType = Shell.hasOwnProperty('ActionMode') ?
                       Shell.ActionMode : Shell.KeyBindingMode;

        Main.wm.addKeybinding(SETTING_KEY_SWITCH_WORKSPACE,
                              this._settings,
                              Meta.KeyBindingFlags.NONE,
                              ModeType.ALL,
                              this._switchWorkspace.bind(this));
    }

    unbindingKey() {
        Main.wm.removeKeybinding(SETTING_KEY_SWITCH_WORKSPACE);
    }

    _switchWorkspace(display, window, binding) {
        popupList.update();

        let tabPopup = new WorkSpacePopup();

        if (!tabPopup.show(binding.is_reversed(), binding.get_name(), binding.get_mask())) {
            //tabPopup.destroy();
        }
    }

    destroy() {
        this.unbindingKey();

        for (let i in SETTING_KEY_WORKSPACE_NAME) {
            this.workspaceNameUnBinding(i);
        }
    }
};

var PopupList = class PopupList {
    constructor() {
        this._popupList = [];
    }

    create() {
        let activeWs = global.workspace_manager.get_active_workspace();
        this._popupList.push(activeWs.index());

        for (let i = 0; i < global.workspace_manager.n_workspaces; i++) {
            if (i === activeWs.index())
                continue;
            this._popupList.push(i);
        }
        this._popupList.reverse();
    }

    update() {
        if (this._popupList.length === 0) {
            this.create();
        } else {
            let activeWs = global.workspace_manager.get_active_workspace();
            let activeWsIndex = activeWs.index();
            if (activeWsIndex != this._popupList[this._popupList.length - 1]) {
                this.moveToTop(activeWsIndex);
            }

            if (this._popupList.length > global.workspace_manager.n_workspaces) {
                let index = this._popupList.indexOf(global.workspace_manager.n_workspaces);
                if (index > -1) {
                    this._popupList.splice(index, 1);
                }
            }

            if (this._popupList.length < global.workspace_manager.n_workspaces) {
                this._popupList.reverse();
                this._popupList.push(global.workspace_manager.n_workspaces - 1);
                this._popupList.reverse();
            }
        }
    }

    moveToTop(workspaceIndex) {
        let index = this._popupList.indexOf(workspaceIndex);

        if (index > -1) {
            this._popupList.splice(index, 1);
        }

        this._popupList.push(workspaceIndex);
    }
};

var WorkSpacePopup = GObject.registerClass(
class WorkSpacePopup extends SwitcherPopup.SwitcherPopup {
    _init() {
        super._init();

        this._switcherList = new WorkSpaceList();
        this._items = this._switcherList.icons;
    }

    _keyPressHandler(keysym, action) {
        if (keysym == Clutter.Left)
            this._select(this._previous());
        else
            this._select(this._next());

        return Clutter.EVENT_STOP;
    }

    _finish() {
        Main.wm.actionMoveWorkspace(this._switcherList.selectWorkspaces[this._selectedIndex]);

        let activeWs = global.workspace_manager.get_active_workspace();
        popupList.moveToTop(activeWs.index());

        super._finish();
    }
});

var WorkSpaceList = GObject.registerClass(
class WorkSpaceList extends SwitcherPopup.SwitcherList {
    _init() {
        super._init(true);

        this._label = new St.Label({ x_align: Clutter.ActorAlign.CENTER,
                                     y_align: Clutter.ActorAlign.CENTER });
        this.add_actor(this._label);

        this.icons = [];

        this.workspaces = this._getWorkSpace();
        this.selectWorkspaces = [];

        let popup = popupList._popupList.slice();
        for (let i = 0; i < global.workspace_manager.n_workspaces; i++) {
            let workspace_index = popup.pop();
            this.selectWorkspaces[i] = this.workspaces[workspace_index];

            let icon = new WorkspaceIcon(Number(workspace_index));

            this.addItem(icon, icon.label);
            this.icons.push(icon);
        }
    }

    _getWorkSpace() {
        let activeWs = global.workspace_manager.get_active_workspace();
        let activeIndex = activeWs.index();
        let ws = [];

        ws[activeIndex] = activeWs;

        for (let i = activeIndex - 1; i >= 0; i--) {
            ws[i] = ws[i + 1].get_neighbor(Meta.MotionDirection.UP);
        }

        for (let i = activeIndex + 1; i < global.workspace_manager.n_workspaces; i++) {
            ws[i] = ws[i - 1].get_neighbor(Meta.MotionDirection.DOWN);
        }

        return ws;
    }

    vfunc_get_preferred_height(forWidth) {
        let [minHeight, natHeight] = super.vfunc_get_preferred_height(forWidth);

        let spacing = this.get_theme_node().get_padding(St.Side.BOTTOM);
        let [labelMin, labelNat] = this._label.get_preferred_height(-1);

        minHeight += labelMin + spacing;
        natHeight += labelNat + spacing;

        return [minHeight, natHeight];
    }

    vfunc_allocate(box, flags) {
        let themeNode = this.get_theme_node();
        let contentBox = themeNode.get_content_box(box);

        let childBox = new Clutter.ActorBox();
        childBox.x1 = contentBox.x1;
        childBox.x2 = contentBox.x2;
        childBox.y2 = contentBox.y2;
        childBox.y1 = childBox.y2 - this._label.height;
        this._label.allocate(childBox, flags);

        let totalLabelHeight = this._label.height + themeNode.get_padding(St.Side.BOTTOM)
        childBox.x1 = box.x1;
        childBox.x2 = box.x2;
        childBox.y1 = box.y1;
        childBox.y2 = box.y2 - totalLabelHeight;
        super.vfunc_allocate(childBox, flags);

        // Hooking up the parent vfunc will call this.set_allocation() with
        // the height without the label height, so call it again with the
        // correct size here.
        this.set_allocation(box, flags);
    }

    highlight(index, justOutline) {
        super.highlight(index, justOutline);

        this._label.set_text(index == -1 ? '' : this.icons[index].label.text);
    }
});

var WorkspaceIcon = GObject.registerClass(
class WorkspaceIcon extends St.BoxLayout {
    _init(workspace_index) {
        super._init({ style_class: 'alt-tab-app',
                      vertical: true });

        let settings = Convenience.getSettings(SCHEMA_NAME);
        let workspaceName = workspace.workspaceName[workspace_index + 1];
        if (workspaceName == null || workspaceName == '')
            workspaceName = "WorkSpace" + " " + String(workspace_index + 1);
        this.label = new St.Label({ text: workspaceName });

        this._icon = new St.Widget({ layout_manager: new Clutter.BinLayout() });
        this._icon.destroy_all_children();
        this.add(this._icon, { x_fill: false, y_fill: false});

        let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
        this._porthole = { width: workArea.width, height: workArea.height,
                           x: workArea.x, y: workArea.y };
        let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        let windowSize = WINDOW_PREVIEW_SIZE * scaleFactor;
        let scale = Math.min(1.0, windowSize / this._porthole.width,
                                windowSize / this._porthole.height);

        let metaWorkspace = global.workspace_manager.get_workspace_by_index(workspace_index);
        this.thumbnail = new WorkspaceThumbnail.WorkspaceThumbnail(metaWorkspace);
        this.thumbnail.setPorthole(this._porthole.x * scale, this._porthole.y * scale,
                                  this._porthole.width, this._porthole.height);
        this.thumbnail._contents.set_scale(scale, scale);

        let icon = new St.Widget({ x_expand: true,
                                   y_expand: true,
                                   y_align:  Clutter.ActorAlign.CENTER });
        icon.add_actor(this.thumbnail);
        let [w, h] = this.thumbnail.get_size();
        icon.set_size(w * scale, h * scale);
        this._icon.add_actor(icon);

        this._icon.add_actor(this._createNumberIcon(workspace_index + 1));
        this._icon.set_size(windowSize, windowSize);
    }

    _createNumberIcon(number) {
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
