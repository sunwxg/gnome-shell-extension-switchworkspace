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
const WorkspaceThumbnail = imports.ui.workspaceThumbnail 
const Extension = imports.misc.extensionUtils.getCurrentExtension();

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const WINDOW_PREVIEW_SIZE = 128;
const APP_ICON_SIZE_SMALL = 48;

const SCHEMA_NAME = 'org.gnome.shell.extensions.switchWorkSpace';
const SETTING_KEY_SWITCH_WORKSPACE = 'switch-workspace';

let workspace;
let popupList;

const WorkSpace= new Lang.Class({
    Name: 'WorkSpace',

    _init : function() {
        this._shellwm =  global.window_manager;
        this._workspaceSwitcherPopup = null;

	this.removeAltAboveTab();
	this.bindingKey();
    },

    bindingKey: function() {
        this._settings = Convenience.getSettings(SCHEMA_NAME);
        this._settings.set_strv(SETTING_KEY_SWITCH_WORKSPACE, ['<Alt>Above_Tab']);

        let ModeType = Shell.hasOwnProperty('ActionMode') ?
            Shell.ActionMode : Shell.KeyBindingMode;

        Main.wm.addKeybinding(SETTING_KEY_SWITCH_WORKSPACE,
            			this._settings,
				Meta.KeyBindingFlags.NONE,
                                ModeType.ALL,
        	                Lang.bind(this, this._switchWorkspace));
    },

    unbindingKey: function() {
        Main.wm.removeKeybinding(SETTING_KEY_SWITCH_WORKSPACE);
    },

    removeAltAboveTab: function() {
        let settings = Convenience.getSettings('org.gnome.desktop.wm.keybindings');
        let oldValue = settings.get_strv('switch-group');
	let newValue = [];

        for (let i = 0; i < oldValue.length; i++) {
		if (oldValue[i] === '<Alt>Above_Tab')
		    continue; 
		newValue.push(oldValue[i]);
        }
        settings.set_strv('switch-group', newValue);
    },
    
    addAltAboveTab: function() {
        let settings = Convenience.getSettings('org.gnome.desktop.wm.keybindings');
        let oldValue = settings.get_strv('switch-group');

	let included = false;
        for (let i = 0; i < oldValue.length; i++) {
		if (oldValue[i] === '<Alt>Above_Tab') {
		    included = true;
		    break; 
		}
        }
	oldValue.push('<Alt>Above_Tab');
        settings.set_strv('switch-group', oldValue);
    },

    _switchWorkspace : function(shellwm, from, to, direction) {
	popupList.update();

        if (this._workspaceSwitcherPopup != null)
            this._workspaceSwitcherPopup.destroy();

        let tabPopup = new WorkSpacePopup();

        if (!tabPopup.show(false, 'switch-windows', 8)) {
            tabPopup.destroy();
	}
    },

    destroy: function() {
	workspace.unbindingKey();
	workspace.addAltAboveTab();
    }
});

const PopupList = new Lang.Class({
    Name: 'PopupList',

    _init : function() {
	this._popupList = [];
	this.create();
    },

    create: function() {
        let activeWs = global.screen.get_active_workspace();
	this._popupList.push(activeWs.index())

        for (let i = 0; i < global.screen.n_workspaces; i++) {
	    if (i === activeWs.index())
		continue;
	    this._popupList.push(i);
	}
	this._popupList.reverse();
    },

    update: function() {
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
        //this._settings = new Gio.Settings({ schema_id: 'org.gnome.shell.window-switcher' });

        //let mode = this._settings.get_enum('app-icon-mode');
        this._switcherList = new WorkSpaceList();
        this._items = this._switcherList.icons;
    },

    _keyPressHandler: function(keysym, action) {
        this._select(this._next());
        return Clutter.EVENT_STOP;

        if (action == Meta.KeyBindingAction.SWITCH_WINDOWS) {
            this._select(this._next());
        } else if (action == Meta.KeyBindingAction.SWITCH_WINDOWS_BACKWARD) {
            this._select(this._previous());
        } else {
            if (keysym == Clutter.Left)
                this._select(this._previous());
            else if (keysym == Clutter.Right)
                this._select(this._next());
            else
                return Clutter.EVENT_PROPAGATE;
        }

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

            let icon = new WindowIcon(workspace_index);

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
        //let [labelMin, labelNat] = this._label.get_preferred_height(-1);
        //alloc.min_size += labelMin + spacing;
        alloc.min_size += spacing;
        //alloc.natural_size += labelNat + spacing;
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

        this.actor = new St.BoxLayout({ style_class: 'alt-tab-app',
                                        vertical: true });
        this._icon = new St.Widget({ layout_manager: new Clutter.BinLayout() });

        this.actor.add(this._icon, { x_fill: false,
				     y_fill: false });
        this.label = new St.Label({ text: "WorkSpace" + " " + String(workspace_index + 1) });

        this._icon.destroy_all_children();

        this._porthole = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);

	let scale = Math.min(1.0, WINDOW_PREVIEW_SIZE / this._porthole.width,
				WINDOW_PREVIEW_SIZE / this._porthole.height);

	let metaWorkspace = global.screen.get_workspace_by_index(workspace_index);
	let thumbnail = new WorkspaceThumbnail.WorkspaceThumbnail(metaWorkspace);

        thumbnail.actor.set_scale(scale, scale);
	this._icon.add_actor(thumbnail.actor);

	//if (this.app)
	//this._icon.add_actor(this._createAppIcon(null, APP_ICON_SIZE_SMALL));

        let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;

        this._icon.set_size(this._porthole.width * scale * scaleFactor,
			    this._porthole.height * scale * scaleFactor);
    },

    _createAppIcon: function(app, size) {
        //let appIcon = app ? app.create_icon_texture(size)
        let appIcon = new St.Icon({ icon_name: 'icon-missing',
                                    icon_size: size });
        appIcon.x_expand = appIcon.y_expand = true;
        appIcon.x_align = appIcon.y_align = Clutter.ActorAlign.END;

        return appIcon;
    }
});

function init() {
	print("wxg: switch workspace init");
}

function enable() {
	print("wxg: switch workspace enable");

	workspace = new WorkSpace();

	popupList = new PopupList();
}

function disable() {
	workspace.destroy();
}
