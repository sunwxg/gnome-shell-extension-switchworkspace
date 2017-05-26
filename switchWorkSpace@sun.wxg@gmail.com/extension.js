const Lang = imports.lang;
const Gio = imports.gi.Gio;
const Shell = imports.gi.Shell;
const GLib = imports.gi.GLib;
const Meta = imports.gi.Meta;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;

const WindowManager = imports.ui.windowManager.WindowManager;
const Main = imports.ui.main;
const AltTab = imports.ui.altTab;
const SwitcherPopup = imports.ui.switcherPopup;
const WorkspaceThumbnail = imports.ui.workspaceThumbnail 


const AppIconMode = {
    THUMBNAIL_ONLY: 1,
    APP_ICON_ONLY: 2,
    BOTH: 3,
};

const WINDOW_PREVIEW_SIZE = 128;
const APP_ICON_SIZE = 96;
const APP_ICON_SIZE_SMALL = 48;

const SHELL_KEYBINDINGS_SCHEMA = 'org.gnome.shell.keybindings';

let popupList;

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

const WorkSpace= new Lang.Class({
    Name: 'WorkSpace',

    _init : function() {
        this._shellwm =  global.window_manager;
        this._workspaceSwitcherPopup = null;

        Main.wm.setCustomKeybindingHandler('switch-to-workspace-down',
                                        Shell.ActionMode.NORMAL,
                                        Lang.bind(this, this._switchWorkspace));
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
	//this._switcherList.selectWorkspaces[this._selectedIndex].index();

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
            let ws_index = popup.pop();
	    this.selectWorkspaces[i] = this.workspaces[ws_index];

            let icon = new WindowIcon(ws_index);

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
        let [labelMin, labelNat] = this._label.get_preferred_height(-1);
        alloc.min_size += labelMin + spacing;
        alloc.natural_size += labelNat + spacing;
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

        this.actor.add(this._icon, { x_fill: false, y_fill: false } );
        this.label = new St.Label({ text: "WorkSpace " + String(workspace_index + 1) });

        let tracker = Shell.WindowTracker.get_default();

        let size;

        this._icon.destroy_all_children();

        let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;

	size = WINDOW_PREVIEW_SIZE;

	let metaWorkspace = global.screen.get_workspace_by_index(workspace_index);
	let thumbnail = new WorkspaceThumbnail.WorkspaceThumbnail(metaWorkspace);
	print("wxg: scaleFactor: ", scaleFactor);
        thumbnail.actor.set_scale(0.125, 0.125);
	this._icon.add_actor(thumbnail.actor);

	//if (this.app)
	this._icon.add_actor(this._createAppIcon(null, APP_ICON_SIZE_SMALL));

	/*
        switch (mode) {
            case AppIconMode.THUMBNAIL_ONLY:
                size = WINDOW_PREVIEW_SIZE;
                this._icon.add_actor(_createWindowClone(mutterWindow, size * scaleFactor));
                break;

            case AppIconMode.BOTH:
                size = WINDOW_PREVIEW_SIZE;
                this._icon.add_actor(_createWindowClone(mutterWindow, size * scaleFactor));

                if (this.app)
                    this._icon.add_actor(this._createAppIcon(this.app,
                                                             APP_ICON_SIZE_SMALL));
                break;

            case AppIconMode.APP_ICON_ONLY:
                size = APP_ICON_SIZE;
                this._icon.add_actor(this._createAppIcon(this.app, size));
        }
	*/

        this._icon.set_size(size * scaleFactor, size * scaleFactor);
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
	let ws = new WorkSpace();

	popupList = new PopupList();
}

function disable() {
}
