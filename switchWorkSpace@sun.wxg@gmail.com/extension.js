import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as SwitcherPopup from 'resource:///org/gnome/shell/ui/switcherPopup.js';
import * as WorkspaceThumbnail from 'resource:///org/gnome/shell/ui/workspaceThumbnail.js';
import * as Background from 'resource:///org/gnome/shell/ui/background.js';

const WINDOW_PREVIEW_SIZE = 128;

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

let hideNumber = false;

class WorkSpace {
    constructor(settings, settingsMutter) {
        this._settings = settings;
        this._settingsMutter = settingsMutter;

        this.addKeybinding();

        this.workspaceName = [];
        this.workspaceNameBindingId = [];

        for (let i in SETTING_KEY_WORKSPACE_NAME) {
            this.workspaceNameBinding(i);
        }

        this.hideEmpty = this._settings.get_boolean(SETTING_KEY_HIDE_EMPTY);
        this.hideEmptyID = this._settings.connect('changed::' + SETTING_KEY_HIDE_EMPTY,
            () => { this.hideEmpty = this._settings.get_boolean(SETTING_KEY_HIDE_EMPTY); });

        hideNumber = this._settings.get_boolean(SETTING_KEY_HIDE_WORKSPACE_NUMBER);
        this.hideNumberID = this._settings.connect('changed::' + SETTING_KEY_HIDE_WORKSPACE_NUMBER,
            () => { hideNumber = this._settings.get_boolean(SETTING_KEY_HIDE_WORKSPACE_NUMBER); });

        this.dynamicWorkspace = this._settingsMutter.get_boolean('dynamic-workspaces');
        this.dynamicWorkspaceID = this._settingsMutter.connect('changed::' + 'dynamic-workspaces',
            () => { this.dynamicWorkspace = this._settingsMutter.get_boolean('dynamic-workspaces'); });
    }

    setPopupList(popupList) {
        this.popupList = popupList;
    }

    getWorkspaceNumber() {
        let numberWorkspace = global.workspace_manager.n_workspaces;
        if (this.hideEmpty && this.dynamicWorkspace)
            numberWorkspace--;

        return numberWorkspace;
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

        this._keyBindingAction =
            Main.wm.addKeybinding(SETTING_KEY_SWITCH_WORKSPACE,
                              this._settings,
                              Meta.KeyBindingFlags.NONE,
                              ModeType.ALL,
                              this._switchWorkspace.bind(this));
        this._keyBindingActionBackward =
            Main.wm.addKeybinding(SETTING_KEY_SWITCH_WORKSPACE_BACKWARD,
                              this._settings,
                              Meta.KeyBindingFlags.IS_REVERSED,
                              ModeType.ALL,
                              this._switchWorkspace.bind(this));
    }

    unbindingKey() {
        Main.wm.removeKeybinding(SETTING_KEY_SWITCH_WORKSPACE);
        Main.wm.removeKeybinding(SETTING_KEY_SWITCH_WORKSPACE_BACKWARD);
    }

    _switchWorkspace(display, window, event, binding) {
        this.popupList.update();

        let tabPopup = new WorkSpacePopup(this._keyBindingAction, this._keyBindingActionBackward, this.popupList, this);

        if (!tabPopup.show(binding.is_reversed(), binding.get_name(), binding.get_mask())) {
            tabPopup.destroy();
        }
    }

    destroy() {
        this.unbindingKey();

        for (let i in SETTING_KEY_WORKSPACE_NAME) {
            this.workspaceNameUnBinding(i);
        }

        if (this.hideEmptyID)
            this._settings.disconnect(this.hideEmptyID);
        if (this.hideNumberID)
            this._settings.disconnect(this.hideNumberID);
        if (this.dynamicWorkspaceID)
            this._settingsMutter.disconnect(this.dynamicWorkspaceID);
    }
};

class PopupList {
    constructor(workspace) {
        this.workspace = workspace;
        this._popupList = [];
        this._workspaceChangedID = global.workspace_manager.connect('active-workspace-changed',
                                                                    this.update.bind(this));
    }

    create() {
        let activeWs = global.workspace_manager.get_active_workspace();
        this._popupList.push(activeWs.index());

        for (let i = 0; i < this.workspace.getWorkspaceNumber(); i++) {
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

            let numberWorkspace = this.workspace.getWorkspaceNumber();
            if (this._popupList.length > numberWorkspace) {
                let index = this._popupList.indexOf(numberWorkspace);
                if (index > -1) {
                    this._popupList.splice(index, 1);
                }
            }

            if (this._popupList.length < numberWorkspace) {
                this._popupList.reverse();
                this._popupList.push(numberWorkspace - 1);
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

    destroy() {
        if (this._workspaceChangedID)
            global.workspace_manager.disconnect(this._workspaceChangedID);
    }
};

var WorkSpacePopup = GObject.registerClass(
class WorkSpacePopup extends SwitcherPopup.SwitcherPopup {
    _init(action, actionBackward, popupList, workspace) {
        super._init();

        this._action = action;
        this._actionBackward = actionBackward;
        this.popupList = popupList;

        this._switcherList = new WorkSpaceList(popupList, workspace);
        this._items = this._switcherList.icons;
    }

    _keyPressHandler(keysym, action) {
        if (action == this._action)
            this._select(this._next());
        else if (action == this._actionBackward)
            this._select(this._previous());
        else if (keysym == Clutter.KEY_Left)
            this._select(this._previous());
        else if (keysym == Clutter.KEY_Right)
            this._select(this._next());
        else
            return Clutter.EVENT_PROPAGATE;

        return Clutter.EVENT_STOP;
    }

    _finish() {
        super._finish();
        Main.wm.actionMoveWorkspace(this._switcherList.selectWorkspaces[this._selectedIndex]);

        let activeWs = global.workspace_manager.get_active_workspace();
        this.popupList.moveToTop(activeWs.index());
    }
});

const SwitcherButton = GObject.registerClass(
class SwitcherButton extends St.Button {
    _init(square) {
        super._init({
            style_class: 'item-box',
            reactive: true,
        });

        this._square = square;
    }
});

var WorkSpaceList = GObject.registerClass(
class WorkSpaceList extends SwitcherPopup.SwitcherList {
    _init(popupList, workspace) {
        super._init(true);

        this._label = new St.Label({ x_align: Clutter.ActorAlign.CENTER,
                                     y_align: Clutter.ActorAlign.CENTER });
        this.add_child(this._label);

        this.icons = [];

        this.workspaces = this._getWorkSpace();
        this.selectWorkspaces = [];

        let popup = popupList._popupList.slice();
        for (let i = 0; i < workspace.getWorkspaceNumber(); i++) {
            let workspace_index = popup.pop();
            this.selectWorkspaces[i] = this.workspaces[workspace_index];

            let icon = new WorkspaceIcon(Number(workspace_index), workspace);

            this.addItem(icon, icon.label);
            this.icons.push(icon);
        }
    }

    _getWorkSpace() {
        let activeWs = global.workspace_manager.get_active_workspace();
        let activeIndex = activeWs.index();
        let ws = [];

        ws[activeIndex] = activeWs;

        let wm = global.workspace_manager;
        const vertical = wm.layout_rows === -1;
        for (let i = activeIndex - 1; i >= 0; i--) {
            if (vertical)
                ws[i] = ws[i + 1].get_neighbor(Meta.MotionDirection.UP);
            else
                ws[i] = ws[i + 1].get_neighbor(Meta.MotionDirection.LEFT);
        }

        for (let i = activeIndex + 1; i < wm.n_workspaces; i++) {
            if (vertical)
                ws[i] = ws[i - 1].get_neighbor(Meta.MotionDirection.DOWN);
            else
                ws[i] = ws[i - 1].get_neighbor(Meta.MotionDirection.RIGHT);
        }

        return ws;
    }

    addItem(item, label) {
        let bbox = new SwitcherButton(this._squareItems);

        bbox.set_child(item);
        this._list.add_child(bbox);

        bbox.connect('clicked', () => this._onItemClicked(bbox));
        bbox.connect('motion-event', () => this._onItemMotion(bbox));

        bbox.label_actor = label;

        this._items.push(bbox);

        return bbox;
    }

    vfunc_get_preferred_height(forWidth) {
        let [minHeight, natHeight] = super.vfunc_get_preferred_height(forWidth);

        let spacing = this.get_theme_node().get_padding(St.Side.BOTTOM);
        let [labelMin, labelNat] = this._label.get_preferred_height(-1);

        minHeight += labelMin + spacing;
        natHeight += labelNat + spacing;

        return [minHeight, natHeight];
    }

    vfunc_allocate(box) {
        let themeNode = this.get_theme_node();
        let contentBox = themeNode.get_content_box(box);

        let totalLabelHeight = this._label.height + themeNode.get_padding(St.Side.BOTTOM)
        let childBox = new Clutter.ActorBox();
        childBox.x1 = box.x1;
        childBox.x2 = box.x2;
        childBox.y1 = box.y1;
        childBox.y2 = box.y2 - totalLabelHeight;
        super.vfunc_allocate(childBox);

        // Hooking up the parent vfunc will call this.set_allocation() with
        // the height without the label height, so call it again with the
        // correct size here.
        this.set_allocation(box);

        childBox.x1 = contentBox.x1;
        childBox.x2 = contentBox.x2;
        childBox.y2 = contentBox.y2;
        childBox.y1 = childBox.y2 - this._label.height;
        this._label.allocate(childBox);

    }

    highlight(index, justOutline) {
        super.highlight(index, justOutline);

        this._label.set_text(index == -1 ? '' : this.icons[index].label.text);
    }
});

var WorkspaceIcon = GObject.registerClass(
class WorkspaceIcon extends St.BoxLayout {
    _init(workspace_index, workspace) {
        super._init({ style_class: 'alt-tab-app',
                      vertical: true });

        this.metaWorkspace = global.workspace_manager.get_workspace_by_index(workspace_index);

        this.connect('destroy', this._onDestroy.bind(this));

        let workspaceName = workspace.workspaceName[workspace_index + 1];
        if (workspaceName == null || workspaceName == '')
            workspaceName = "Workspace" + " " + String(workspace_index + 1);
        this.label = new St.Label({ text: workspaceName });

        this._icon = new St.Widget({ layout_manager: new Clutter.BinLayout() });
        this._icon.destroy_all_children();
        this.add_child(this._icon);

        let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
        this._porthole = { width: workArea.width,
                           height: workArea.height,
                           x: workArea.x,
                           y: workArea.y };

        let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        let windowSize = WINDOW_PREVIEW_SIZE * scaleFactor;
        this.scale = Math.min(1.0, windowSize / this._porthole.width,
                                   windowSize / this._porthole.height);

        this._createBackground(Main.layoutManager.primaryIndex);

        this._createWindowThumbnail();

        if (!hideNumber)
            this._icon.add_child(this._createNumberIcon(workspace_index + 1));
    }

    _createWindowThumbnail() {
        this._windowsThumbnail = new St.Widget();

        let windows = global.get_window_actors().filter(actor => {
            let win = actor.meta_window;
            return win.located_on_workspace(this.metaWorkspace);
        });

        for (let i = 0; i < windows.length; i++) {
            if (this._isMyWindow(windows[i])) {
                let clone = new WindowClone(windows[i]);
                this._windowsThumbnail.add_child(clone);
            }
        }

        this._windowsThumbnail.set_size(Math.round(this._porthole.width * this.scale),
                                        Math.round(this._porthole.height * this.scale));
        this._windowsThumbnail.set_scale(this.scale, this.scale);
        this._icon.add_child(this._windowsThumbnail);
    }

    _isMyWindow(actor) {
        let win = actor.meta_window;
        return win.located_on_workspace(this.metaWorkspace) &&
            (win.get_monitor() == Main.layoutManager.primaryIndex);
    }

    _createBackground(index) {
        this._backgroundGroup = new Clutter.Actor({
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
            y_expand: true,
        });
        this._icon.add_child(this._backgroundGroup);

        this._bgManager = new Background.BackgroundManager({
            container: this._backgroundGroup,
            monitorIndex: index,
            controlPosition: false,
            useContentSize: false,
        });
        this._backgroundGroup.set_size(Math.round(this._porthole.width * this.scale),
                                        Math.round(this._porthole.height * this.scale));
    }

    _createNumberIcon(number) {
        let icon = new St.Widget({ x_expand: true,
                                   y_expand: true,
                                   x_align:  Clutter.ActorAlign.END,
                                   y_align:  Clutter.ActorAlign.END });

        let box = new St.BoxLayout({ style_class: 'number-window',
                                     vertical: true });
        icon.add_child(box);

        let label = new St.Label({ style_class: 'number-label',
                                   text: number.toString() });
        box.add_child(label);

        return icon;
    }

    _onDestroy() {
        if (this._bgManager) {
            this._bgManager.destroy();
            this._bgManager = null;
        }
    }
});

const PrimaryActorLayout = GObject.registerClass(
class PrimaryActorLayout extends Clutter.FixedLayout {
    _init(primaryActor) {
        super._init();

        this.primaryActor = primaryActor;
    }

    vfunc_get_preferred_width(container, forHeight) {
        return this.primaryActor.get_preferred_width(forHeight);
    }

    vfunc_get_preferred_height(container, forWidth) {
        return this.primaryActor.get_preferred_height(forWidth);
    }
});

const WindowClone = GObject.registerClass({
}, class WindowClone extends Clutter.Actor {
    _init(realWindow) {
        let clone = new Clutter.Clone({
            source: realWindow,
        });
        super._init({
            layout_manager: new PrimaryActorLayout(clone),
            reactive: true,
        });
        this._delegate = this;

        let index = global.display.get_primary_monitor();
        let monitor = global.display.get_monitor_geometry(index);
        this.set_position(realWindow.x -monitor.x, realWindow.y - monitor.y - Main.panel.height);

        this.add_child(clone);
    }
});

export default class SwitchWorkspaceExtension extends Extension {

    enable() {
        this._settings = this.getSettings();
        this._settingsMutter = this.getSettings("org.gnome.mutter");
        this.workspace = new WorkSpace(this._settings, this._settingsMutter);
        this.popupList = new PopupList(this.workspace);
        this.workspace.setPopupList(this.popupList);
    }

    disable() {
        this.workspace.destroy();
        this.workspace = null;

        this.popupList.destroy();
        this.popupList = null;

        this._settings = null;
        this._settingsMutter = null;
    }
}
