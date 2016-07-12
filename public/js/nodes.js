"use strict";

// erlang nodes status.

var nodes = [];
var nodes_cur_idx = 0;
var token = "dummy_secret...";

function check_url_fragment() {
	if (location.hash && location.hash.length >= 2) {
		var fragment = location.hash.slice(1);
	}
	return false;
}

function on_nodes_result(result) {
	if (result == null || result.status != 'ok') {
		console.log("nodes status:" + result.status);
		return;
	}
	nodes = result.nodes;
	nodes_cur_idx = 0;

	element_clear($("#nodes"));
	for (var i=0; i<nodes.length; i++) {
		var nodename = element('label', [element('input',[], {type: 'checkbox', name: 'rpc_node_' + nodes[i], checked: true}), nodes[i]]);
		var row = element('tr', [
				element('td', nodename, {className:'node_name'}),
				element('td', '-'),
				element('td', '-'),
				element('td', '-'),
				element('td', '-'),
				element('td', '-'),
				element('td', '-'),
				element('td', '-', {id: 'status_' + nodename})
			]);
		row.id = 'node_' + nodes[i];
		element_append($("#nodes"),row);
	}

	if (nodes.length == 1) {
		$("#view_procs_link").href = "procs.html?node=" + nodes[0];
	} else {
		$("#view_procs_link").href = "procs.html";
	}
}

function number_format(n) {
	return String(n).replace(/\d(?=(\d{3})+$)/g, '$&,');
}

function on_node_status_result(nodename, result) {
	if (result == null || result.status != 'ok') {
		console.log("nodes status:" + result.status);
		return;
	}
	var node = result.node;
	var e = document.getElementById('node_' + nodename);
	if (e) {
		if (result.connected) {
			var ne = e.firstChild;
			element_clear(e);
			element_append(e, [
				ne,
				element('td', number_format(node.process_count), {className:'number'}),
				element('td', number_format(node.memory.total), {className:'number'}),
				element('td', number_format(node.memory.processes), {className:'number'}),
				element('td', number_format(node.memory.binary), {className:'number'}),
				element('td', number_format(node.memory.atom), {className:'number'}),
				element('td', number_format(node.memory.ets), {className:'number'}),
				element('td', "ok", {id:'status_'+nodename,title:result.timestamp.substring(0,19)})
			]);
		} else {
			document.getElementById('status_' + nodename).innerText = "ERR";
		}
	} else {
		console.log("element not found.");
		console.log(result.node);
	}

}

function get_node_status(node) {
	getJson("/nodes/" + node + "?connect=true", function(r){on_node_status_result(node, r);});
}

function tick() {
	if (nodes.length == 0) return;

	get_node_status(nodes[nodes_cur_idx]);
	nodes_cur_idx = (nodes_cur_idx+1) % nodes.length;
}

var beamfiles = [];
function addBeamFile(file) {
	beamfiles.push(file);
	element_append($('#files'), element('li', file.name));
}
function clearBeamFiles() {
	beamfiles = [];
	element_clear($('#files'));
}
function uploadBeamFiles() {
	for (var i=0; i<beamfiles.length; i++) {
		uploadBeamFile(beamfiles[i]);
	}
}

function uploadBeamFile(file) {
	if (file == null) return;
	var form = document.forms['node_select_form'];
	var formData = new FormData();
	formData.append('beam', file, file.name);
	formData.append("FORCE_PURGE",  $('#use_soft_purge').checked ? 'false':'true');

	for (var i=0; i < nodes.length; i++) {
		if (!form["rpc_node_"+nodes[i]].checked) continue;
		var xhr = requestJson('POST', "/nodes/" + nodes[i] + "/code", function(result) {
			if (result && result.status=='ok') {
				element_append($('#rpc_result'), element('li', result.node+" : "+result.result, {style: "color:blue"}));
			} else {
				element_append($('#rpc_result'), element('li', 'error', {style: "color:red"}));
			}
		});
		xhr.setRequestHeader("X-CSRFToken", token);
		xhr.send(formData);
	}
}

window.addEventListener('load',(function(e){

	window.addEventListener('hashchange',(function(e){
		check_url_fragment();
	}),false);

	document.forms['rpc_form'].addEventListener('submit', function(e){
		e.preventDefault();
		element_clear($('#rpc_result'));
		var form = document.forms['rpc_form'];
		var code = form.rpc_code.value;
		var formData = new FormData();
		formData.append("code", code);
		formData.append("result_as_string", "true");
		for (var i=0; i < nodes.length; i++) {
			if (!document.forms['node_select_form']["rpc_node_"+nodes[i]].checked) continue;
			var xhr = requestJson('POST', "/nodes/" + nodes[i] + "/exec", function(result) {
				if (result && result.status=='ok') {
					element_append($('#rpc_result'), element('li', result.node+" : "+result.result, {style: "color:blue"}));
				} else {
					element_append($('#rpc_result'), element('li', 'error', {style: "color:red"}));
				}
			});
			xhr.setRequestHeader("X-CSRFToken", token);
			xhr.send(formData); // send(JSON.stringify({"code":code, "result_as_string":true}));
		}
	});

	onClick($('#select_all'), function(e){
		e.preventDefault();
		var form = document.forms['node_select_form'];
		for (var i=0; i < nodes.length; i++) {
			form["rpc_node_"+nodes[i]].checked = true;
		}
	});
	onClick($('#select_clear'), function(e){
		e.preventDefault();
		var form = document.forms['node_select_form'];
		for (var i=0; i < nodes.length; i++) {
			form["rpc_node_"+nodes[i]].checked = false;
		}
	});

	// attach file
	var e = $('#upload_beam');
	e.addEventListener('dragover', function(e){
		e.preventDefault();
	});
	e.addEventListener('drop', function(e){
		e.preventDefault();
		element_clear($('#rpc_result'));
		var files = e.dataTransfer.files;
		for (var i=0; i<files.length; i++) {
			addBeamFile(files[i]);
		}
	});
	onClick($('#attach_button'), function(e){
		e.preventDefault();
		var f = element('input',[], {type: "file"});
		f.style.display="none";
		element_append($('#rpc_form'), f);
		f.addEventListener('change', function(e) {
			var files = f.files;
			for (var i=0; i<files.length; i++) {
				addBeamFile(files[i]);
			}
		});
		f.click();
	});
	onClick($('#upload_button'), function(e){
		e.preventDefault();
		element_clear($('#rpc_result'));
		uploadBeamFiles();
		clearBeamFiles();
	});
	onClick($('#clear_beams_button'), function(e){
		e.preventDefault();
		clearBeamFiles();
	});

	getJson("/nodes?cluster=true", on_nodes_result);
	setInterval(tick, 1000);

}),false);
