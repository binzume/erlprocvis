"use strict";

function getxhr() {
	var xhr;
	if(window.XMLHttpRequest) {
		xhr =  new XMLHttpRequest();
	} else if(window.ActiveXObject) {
		try {
			xhr = new ActiveXObject('Msxml2.XMLHTTP');
		} catch (e) {
			xhr = new ActiveXObject('Microsoft.XMLHTTP');
		}
	}
	return xhr;
}

function getJson(url,f){
	var xhr = getxhr();
	xhr.open('GET', url);
	xhr.onreadystatechange = function() {
		if (xhr.readyState != 4) return;
		if (f) {
			if (xhr.status == 200) {
				f(JSON.parse(xhr.responseText))
			} else {
				f(undefined)
			}
		}
	};
	xhr.send();
}

function requestJson(method, url, f){
	var xhr = getxhr();
	xhr.open(method, url);
	xhr.onreadystatechange = function() {
		if (xhr.readyState != 4) return;
		if (f) {
			if (xhr.status == 200) {
				f(JSON.parse(xhr.responseText))
			} else {
				f(undefined)
			}
		}
	};
	return xhr;
}

function element_append(e, v) {
	if (v instanceof Array) {
		for (var i = 0; i < v.length; i++) {
			element_append(e, v[i]);
		}
	} else {
		e.appendChild((typeof v == 'string')?document.createTextNode(v):v);
	}
}

function element_clear(e) {
	while (e.firstChild) {
	    e.removeChild(e.firstChild);
	}
}

function element(tag, values, attr) {
	var e = document.createElement(tag);
	if (values) {
		element_append(e, values);
	}
	if (typeof(attr) == "function") {
		attr(e);
	} else if (typeof(attr) == "object") {
		for (var key in attr) {
			e[key] = attr[key];
		}
	}
	return e;
}


function bindObj(o, f) {
	return function() {return f.apply(o, arguments)};
}

function onClick(element, func) {
	element.addEventListener('click', func, false);
}

if (window.$ === undefined) {
	window.$ = document.querySelector.bind(document);
}



// UI

function Dialog(elem, cancel) {
	var self = this;
	this.elem = elem;
    this._oncancel = bindObj(this, this.oncancel);
    this.onDismissFuncs = [];
	elem.addEventListener('click', this.donothing, false);

	if (cancel) {
		cancel.addEventListener('click', this._oncancel, false);
		this.onDismissFuncs.push(function(){cancel.removeEventListener('click', self._oncancel, false)});
	} else {
		var cancels = elem.getElementsByClassName('dialog_cancel');
		for (var i=0; i<cancels.length; i++) {
			var cancel = cancels[i];
			cancel.addEventListener('click', this._oncancel, false);
			this.onDismissFuncs.push(function(){cancel.removeEventListener('click', self._oncancel, false)});
		}
	}
}

Dialog.prototype.show = function() {
	this.elem.style.display = "block";
	var self = this;
	setTimeout(function() {
		document.body.addEventListener('click', self._oncancel, false);
	 }, 1);
	return this;
}

Dialog.prototype.dismiss = function() {
	this.elem.style.display = "none";
    document.body.removeEventListener('click', this._oncancel, false);
	this.elem.removeEventListener('click', this.donothing, false);
	while (this.onDismissFuncs.length > 0) {
		(this.onDismissFuncs.pop())();
	}
	return this;
}

Dialog.prototype.onClick = function(id, f) {
	var self = this;
	var e = document.getElementById(id);
	var onclick =  function(e){
		e.preventDefault();
		self.dismiss();
		f(this, self);
	};
	e.addEventListener('click', onclick, false);
	this.onDismissFuncs.push(function(){e.removeEventListener('click', onclick, false)});

	return this;
}

Dialog.prototype.oncancel = function(e) {
	e.preventDefault();
	this.dismiss();
}

Dialog.prototype.donothing = function(e) {
	// e.preventDefault();
	e.stopPropagation();
}

function get_param(name, def) {
	var params = window.location.search.substring(1).split('&');
	for (var i = 0; i < params.length; i++) {
		var kv = decodeURIComponent(params[i]).split('=');
		if (kv[0] == name) { return kv[1]; }
	}
	return def;
}
function get_bool_param(name, def) {
	return get_param(name, String(def)) == "true";
}


function Toast(elem, text) {
	if (elem == null) {
		elem = element('div', text);
		elem.className = 'toast';
		element_append(document.body, elem);
	} else {
		elem.innerText = text;
	}
	this.elem = elem;
}

Toast.prototype.show = function(duration) {
	if (duration == null) {
		duration = 1000;
	}
	var elem = this.elem;
	elem.style.display = "block";
	setTimeout(function(){ elem.style.display="none"; elem.parentElement.removeChild(elem); }, duration);
}

