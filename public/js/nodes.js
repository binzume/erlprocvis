"use strict";

// erlang nodes status.

var nodes = [];
var nodes_cur_idx = 0;

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
				element('td', element('a', nodes[i], {href: "procs.html?node=" + nodes[i]})),
				element('td', '-'),
				element('td', '-'),
				element('td', '-'),
				element('td', '-'),
				element('td', '-'),
				element('td', '-')
			]);
		row.id = 'node_' + nodes[i];
		element_append($("#nodes"),row);
	}
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
			element('td', element('a', node.name, {href: "procs.html?node=" + node.name})),
			element('td', ""+node.process_count),
			element('td', ""+node.memory.total),
			element('td', ""+node.memory.processes),
			element('td', ""+node.memory.binary),
			element('td', ""+node.memory.atom),
			element('td', ""+node.memory.ets)
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

window.addEventListener('load',(function(e){

	window.addEventListener('hashchange',(function(e){
		check_url_fragment();
	}),false);

	getJson("/nodes?cluster=true", on_nodes_result);
	setInterval(tick, 1000);

}),false);
