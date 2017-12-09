
schemas:
	glib-compile-schemas switchWorkSpace@sun.wxg@gmail.com/schemas/
submit:
	cd switchWorkSpace@sun.wxg@gmail.com/ && zip -r ~/switchWorkspace.zip *

install:
	rm -r ~/.local/share/gnome-shell/extensions/switchWorkSpace@sun.wxg@gmail.com
	cp -r switchWorkSpace@sun.wxg@gmail.com ~/.local/share/gnome-shell/extensions/

