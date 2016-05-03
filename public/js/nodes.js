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
		var row = element('tr', [
				element('td', nodes[i]),
				element('td', '-'),
				element('td', '-'),
				element('td', '-'),
				element('td', '-'),
				element('td', '-'),
				element('td', '-'),
				element('td', element('a', 'View procs', {href: "procs.html?node=" + nodes[i]}))
			]);
		row.id = 'node_' + nodes[i];
		element_append($("#nodes"),row);
	}

	element_clear($("#rpc_nodes"));
	for (var i=0; i<nodes.length; i++) {
		var row = element('li', [
				element('label', [element('input',[], {type: 'checkbox', name: 'rpc_node_' + nodes[i], checked: true}), nodes[i]])
			]);
		element_append($("#rpc_nodes"),row);
	}
}

function number_format(n) {
	return String(n).replace(/\d(?=(\d{3})+$)/g, '$&,');
}

function on_node_status_result(result) {
	if (result == null || result.status != 'ok') {
		console.log("nodes status:" + result.status);
		return;
	}
	var node = result.node;
	var e = document.getElementById('node_' + node.name);
	if (e) {
		element_clear(e);
		element_append(e, [
			element('td', node.name, {className:'node_name'}),
			element('td', number_format(node.process_count)),
			element('td', number_format(node.memory.total)),
			element('td', number_format(node.memory.processes)),
			element('td', number_format(node.memory.binary)),
			element('td', number_format(node.memory.atom)),
			element('td', number_format(node.memory.ets)),
			element('td', element('a', 'View procs', {href: "procs.html?node=" + node.name}))
		]);
	} else {
		console.log("element not found.");
		console.log(result.node);
	}

}

function tick() {
	if (nodes.length == 0) return;

	getJson("/nodes/" + nodes[nodes_cur_idx] + "?connect=true", on_node_status_result);
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
	var form = document.forms['rpc_form'];
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
		formData.append("result_response", "true");
		for (var i=0; i < nodes.length; i++) {
			if (!form["rpc_node_"+nodes[i]].checked) continue;
			var xhr = requestJson('POST', "/nodes/" + nodes[i] + "/exec", function(result) {
				if (result && result.status=='ok') {
					element_append($('#rpc_result'), element('li', result.node+" : "+result.result, {style: "color:blue"}));
				} else {
					element_append($('#rpc_result'), element('li', 'error', {style: "color:red"}));
				}
			});
			xhr.setRequestHeader("X-CSRFToken", token);
			xhr.send(formData); // send(JSON.stringify({"code":code, "result_response":true}));
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
		// e.preventDefault();
		element_clear($('#rpc_result'));
		uploadBeamFiles();
		clearBeamFiles();
	});
	onClick($('#clear_beams_button'), function(e){
		clearBeamFiles();
	});


	getJson("/nodes?cluster=true", on_nodes_result);
	setInterval(tick, 1000);

}),false);
