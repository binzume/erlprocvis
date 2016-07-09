"use strict";
// nodes and edges
var graph = newGraph();
var size = 20;
var search = "";
var defaultNodeColor = [0.6, 1.0, 1.0, 1.0];
var nodeTexSize = 256;
var displayPort = true;
var displayRemote = true;
var displayRemoteProc = false;

function newGraph() {
	return {nodes:[], edges:[], nodeindex:[], repulsion: true};
}

function circleText(ctx, str, cx, cy, r, st) {
	ctx.save();
	ctx.translate(cx, cy);
	ctx.rotate(st);
	for (var p=0; p<str.length; p++) {
		ctx.fillText(str[p], 0, -r);
		ctx.rotate(ctx.measureText(str[p]).width / r);
	}
	ctx.restore();
}


function check_url_fragment() {
	if (location.hash && location.hash.length >= 2) {
		var fragment = location.hash.slice(1);
		search = fragment;
		var nodes = graph.nodes;
		// init nodes
		for (var i=0; i<nodes.length; i++) {
			var node = nodes[i];
			if (node.type != 'proc') continue;
			if (node.proc.initial_call.startsWith(search) || node.proc.registered_name && node.proc.registered_name.startsWith(search)) {
				node.color = [0, 1.0, 0, 1.0];
			} else {
				node.color = defaultNodeColor;
			}
		}

	}
	return false;
}

function on_nodes_result(result) {
	if (result == null || result.status != 'ok') {
		console.log("proc_loaded status:" + result.status);
		return;
	}
	var ernodes = result.nodes;

	graph = newGraph();

	for (var i=0; i<ernodes.length; i++) {
		var node = ernodes[i];
		graph.nodeindex[node.name] = graph.nodes.length;
		graph.nodes.push({type: "node", name: node.name, node: node.name, weight: 3.0, weight2: 1.0, links: []});
	}

	init_graph(null);
	check_url_fragment();
}

function proc_loaded(result) {
	if (result == null || result.status != 'ok') {
		console.log("proc_loaded status:" + result.status);
		return;
	}

	// console.time('proc_loaded');
	var procs = result.processes;
	var oldgraph = graph;
	graph = newGraph();
	var nodes = graph.nodes;
	var edges = graph.edges;
	var nodeindex = graph.nodeindex;

	for (var i=0; i<procs.length; i++) {
		var proc = procs[i];
		if (!proc.alive) continue;
		nodeindex[proc.id] = nodes.length;
		nodes.push({type: "proc", name: proc.id, proc: proc, weight: 1.0, weight2: Math.max(1,proc.links.length), links: []});
	}

	for (var i=0; i<procs.length; i++) {
		var proc = procs[i];
		if (!proc.alive) continue;
		var procnode = proc.id.split(':')[0];
		for (var j=0; j<proc.links.length; j++) {
			var l = proc.links[j];
			var addedge = proc.id < l;
			var edgeweight = 1.0;
			if (proc.links.length > 1) {
				// node weight = node.links.length
				// edgeweight = 1.0 / (proc.links.length-1);
			}
			var lineUV = 0;
			if (!l.startsWith(procnode)) {
				// remote or port
				addedge = true;
				if (l.startsWith('<#Port:')) {
					edgeweight *= 0.5;
					lineUV = 0.6;
					if ( !nodeindex[l] && displayPort) {
						nodeindex[l] = nodes.length;
						nodes.push({type: "port", name: l, weight: 0.5, weight2: 1.0, links: [], color: [0,1.0,0,0.5]});
					}
				} else {
					var nodename = l.split(':')[0].slice(1);
					if (!displayRemoteProc) l = nodename;
					edgeweight *= 0.001;
					lineUV = 0.5;
					if ( !nodeindex[l] && displayRemote) {
						nodeindex[l] = nodes.length;
						nodes.push({type: "node", name: l, weight: 1.0, weight2: 1.0, node: nodename, links: [], color: [1.0,1.0,0,0.5]});
					}
				}
			}
			if (addedge) {
				// console.log("link: " + proc.id + " <-> " + l);
				if (nodeindex[l]!=null && nodeindex[proc.id]!=null) {
					var ls = proc.links.length;
					if (nodes[nodeindex[l]].proc) {
						ls += nodes[nodeindex[l]].proc.links.length;
					} else if (nodes[nodeindex[l]].type == 'node') {
						ls += procs.length / 2;
					}
					edges.push({from: nodeindex[proc.id], to: nodeindex[l], weight: edgeweight, len: Math.sqrt(ls - 1), type: "link", line_uv: lineUV});
					nodes[nodeindex[proc.id]].links.push(l);
					nodes[nodeindex[l]].links.push(proc.id);
				}
			}
		}

		for (var j=0; j<proc.monitors.length; j++) {
			var l = proc.monitors[j];
			// console.log("monitor: " + proc.id + " -> " + l);
			if (nodeindex[l]!=null && nodeindex[proc.id]!=null) {
				edges.push({from: nodeindex[proc.id], to: nodeindex[l], weight: 0.01, len: 1.0, type: "monitor", line_uv:0.5});
			}
		}
	}

	init_graph(oldgraph);

	// console.timeEnd('proc_loaded');

	check_url_fragment();

	// console.timeEnd('proc_loaded');
}

function init_graph(oldgraph) {
	var oldnodes = oldgraph ? oldgraph.nodes : [];
	var oldnodeindex = oldgraph ? oldgraph.nodeindex : [];
	var nodes = graph.nodes;
	var edges = graph.edges;
	var nodeindex = graph.nodeindex;

	var canvas = document.createElement("canvas");
	canvas.width  = nodeTexSize;
	canvas.height = nodeTexSize;
	var ctx = canvas.getContext("2d");


	// init nodes
	for (var i=0; i<nodes.length; i++) {
		var node = nodes[i];

		if (oldnodeindex[node.name] != null ) {
			// restore old position.
			var oldnode = oldnodes[oldnodeindex[node.name]];
			node.x = oldnode.x;
			node.y = oldnode.y;
			node.z = oldnode.z;
			node.rot = oldnode.rot;
			node.tex = null;
			if (node.type == 'proc' && node.proc.trap_exit == oldnode.proc.trap_exit && node.proc.registered_name == oldnode.proc.registered_name) {
				node.tex = oldnode.tex;
			}
		} else {
			node.x = Math.random() * size - size/2;
			node.y = Math.random() * size - size/2;
			node.z = Math.random() * size - size/2;
			node.rot = Math.random() * 360;
		}

		node.v = [0,0,0];
		if (!node.color) {
			node.color = defaultNodeColor;
		}
		if (node.type=='proc') {
			if (node.proc.message_queue_len > 0) {
				node.color = [1.0, 1.0, 0.3, 1.0];
			}
		}
		if (node.tex == null) {
			ctx.clearRect(0, 0, nodeTexSize, nodeTexSize);
			ctx.font = "20px monospace";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillStyle = "white";
			if (node.type=='node') {
				circleText(ctx, node.name, nodeTexSize / 2, nodeTexSize / 2, nodeTexSize*0.40, 0);
			} else {
				circleText(ctx, node.name, nodeTexSize / 2, nodeTexSize / 2, nodeTexSize*0.31, 0);
			}
			if (node.type=='proc') {
				var procName = "";
				if (node.proc.registered_name && node.proc.registered_name.length>0) {
					procName = node.proc.registered_name;
				} else {
					procName = node.proc.initial_call || "";
				}
				circleText(ctx, procName, nodeTexSize/2, nodeTexSize/2, nodeTexSize*0.38, Math.PI * 0.3);
				if (node.proc.trap_exit) {
					ctx.font = "10px monospace";
					circleText(ctx, "trap_exit", nodeTexSize/2, nodeTexSize/2, nodeTexSize*0.51, Math.PI * 0.2);
				}
			}
			node.tex = GL.Texture.fromImage(canvas, {});
		}
	}
	graph.repulsion = false;
	for (var i=0; i<50; i++) {
		adjust_pos(graph);
	}
	graph.repulsion = true;
	for (var i=0; i<20; i++) {
		adjust_pos(graph);
	}
}

function adjust_pos(graph) {
	var nodes = graph.nodes;
	var edges = graph.edges;
	var nodeindex = graph.nodeindex;
	// position
	var sk = 0.5;

	if (graph.repulsion) {
		for (var i=0; i<nodes.length; i++) {
			var node = nodes[i];
			var f = [0.0,0.0,0.0];

			var dd = node.x*node.x + node.y*node.y + node.z*node.z;
			if (dd < 2.0) dd = 2.0
			f[0] += -node.x * 0.1 / dd * node.weight;
			f[1] += -node.y * 0.1 / dd * node.weight;
			f[2] += -node.z * 0.1 / dd * node.weight;

			for (var j=0; j<nodes.length; j++) {
				if (j == i) continue;
				var node2 = nodes[j];
				var dx = node.x - node2.x, dy = node.y - node2.y, dz = node.z - node2.z;
				var dd = dx*dx + dy*dy + dz*dz + 0.01;
				var st = node.weight * node2.weight / dd * 0.2;
				var ff = st / Math.sqrt(dd);
				f[0] += dx * ff;
				f[1] += dy * ff;
				f[2] += dz * ff;
			}

			node.v[0] += f[0] / node.weight2;
			node.v[1] += f[1] / node.weight2;
			node.v[2] += f[2] / node.weight2;
		}
	}

	for (var i=0; i<edges.length; i++) {
		var edge = edges[i];
		if (edge.weight == 0) continue;
		var node = nodes[edge.from];
		var node2 = nodes[edge.to];

		var dx = node.x - node2.x, dy = node.y - node2.y, dz = node.z - node2.z;
		var dd = dx*dx + dy*dy + dz*dz;
		var dn = Math.sqrt(dd) + 0.01;
		var w = (dn-edge.len) * sk * edge.weight / dn;
		var w1 = w / node.weight2;
		var w2 = w / node2.weight2;
		node.v[0] -= dx * w1;
		node.v[1] -= dy * w1;
		node.v[2] -= dz * w1;
		node2.v[0] += dx * w2;
		node2.v[1] += dy * w2;
		node2.v[2] += dz * w2;
	}

	for (var i=0; i<nodes.length; i++) {
		var node = nodes[i];
		node.x += node.v[0];
		node.y += node.v[1];
		node.z += node.v[2];
		node.v[0] *= 0.7;
		node.v[1] *= 0.7;
		node.v[2] *= 0.7;
	}
}


// view
var gl;

var angleX = 20;
var angleY = 20;
var autoRotate = get_bool_param("rotation", false);
var autoRefresh = get_bool_param("polling", false);
var cameraPos = new GL.Vector(0,0,-20);
var center = new GL.Vector(0,0,0);
var target_center = new GL.Vector(0,0,0);
var selected = null;
var rot = 0;
var autoRefreshT = 0;


function init_gl() {
	gl = GL.create();
	var vs = document.getElementById("vs").textContent;
	var fs = document.getElementById("fs").textContent;
	var shader = new GL.Shader(vs, fs);
	var tex01 = GL.Texture.fromURL('images/node_circle.png');
	var tex03 = GL.Texture.fromURL('images/node_selected.png');
	var tex02 = GL.Texture.fromURL('images/link_tex.png');
	var tex04a = GL.Texture.fromURL('images/node_alpha.png');
	var edgelines = new GL.Mesh({ coords: true, lines: true });
	var nodeSphere = new GL.Mesh.sphere({detail: 4 }).computeWireframe();
	var mesh = GL.Mesh.plane({coords: true});

	gl.onupdate = function(seconds) {
		rot += 45 * seconds;

		if (button == -1) {
			adjust_pos(graph);
		}
		var nodes = graph.nodes;
		var edges = graph.edges;

		edgelines.vertices = [];
		edgelines.coords = [];
		edgelines.lines = [];
		for (var i=0; i<edges.length; i++) {
			var edge = edges[i];
			var from = nodes[edge.from];
			var to = nodes[edge.to];
			var d = edge.line_uv;
			edgelines.vertices.push([from.x, from.y, from.z], [to.x, to.y, to.z]);
			edgelines.coords.push([0,d], [1,d]);
			edgelines.lines.push([i*2, i*2+1]);
		}
		edgelines.compile();

		autoRefreshT += seconds;
		if (autoRefresh && autoRefreshT > 30) {
			refresh();
			autoRefreshT = 0;
		}
		if (autoRotate) {
			angleY += 15 * seconds;
		}
		if (selected) {
			target_center.x = selected.x;
			target_center.y = selected.y;
			target_center.z = selected.z;
		}
		center = center.multiply(0.8).add(target_center.multiply(0.2));
	};

	gl.ondraw = function() {
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE);
		gl.enable( gl.BLEND );
		gl.enable( gl.DEPTH_TEST );
		gl.loadIdentity();
		gl.translate(cameraPos.x, cameraPos.y, cameraPos.z);
		gl.rotate(30, 1, 0, 0);
		gl.rotate(angleX, 1, 0, 0);
		gl.rotate(angleY, 0, 1, 0);
		gl.translate(-center.x, -center.y, -center.z);

		var nodes = graph.nodes;
		var edges = graph.edges;
		var nodeindex = graph.nodeindex;
		for (var i=0; i<nodes.length; i++) {
			var node = nodes[i];
			gl.pushMatrix();

			gl.translate(node.x, node.y, node.z);

			if (node.type == 'node') {
				gl.pushMatrix();
				gl.rotate(rot  + node.rot, 0, 0, 1);
				tex02.bind(2);
				gl.lineWidth(2);
				shader.uniforms({
					texture: 2,
					color: [1.0, 1.0, 1.0, 0.5]
				}).draw(nodeSphere,gl.LINES);
				gl.popMatrix();
			}

			// billboard
			gl.rotate(-angleY, 0, 1, 0);
			gl.rotate(-angleX, 1, 0, 0);
			if (node.type != 'node') {
				gl.rotate(rot  + node.rot, 0, 0, 1);
			}

			tex01.bind(1);

			if (node == selected) {
				tex03.bind(3);
				shader.uniforms({
					texture: 3,
					color: [0,1,0,1]
				}).draw(mesh);
			}

			if (node.type == 'proc') {
				shader.uniforms({
					texture: 1,
					color: node.color
				}).draw(mesh);

				gl.pushMatrix();
				gl.scale(0.94, 0.94, 0.94);
				gl.rotate(-rot*1.6 + node.rot * 3, 0, 0, 1);
				shader.draw(mesh);
				gl.popMatrix();
			} else if (node.type == 'node') {
				gl.scale(1.5,1.5,1.5);
			} else if (node.type == 'port') {
				gl.scale(0.8,0.8,0.8);
				gl.pushMatrix();
				gl.scale(0.5, 0.5, 0.5);
				tex04a.bind(3);
				shader.uniforms({
					texture: 3,
					color: node.color
				}).draw(mesh);
				gl.popMatrix();
			}

			node.tex.bind(3);
			shader.uniforms({
				texture: 3,
				color: node.color
			}).draw(mesh);

			gl.popMatrix();
		}

		if (edgelines.lines.length > 0) {
			tex02.bind(2);
			gl.lineWidth(2);
			shader.uniforms({
				texture: 2,
				color: [1.0, 1.0, 1.0, 1.0]
			}).draw(edgelines,gl.LINES);
		}

	};

	gl.onmousedown = function(e) {
		e.preventDefault();
		button = e.button;
		drag = false;
	};
	gl.onmouseup = function(e) {
		button = -1;
	};

	gl.onmousemove = function(e) {
		if (e.dragging) {
			if (e.deltaX*e.deltaX + e.deltaY * e.deltaY > 2) {
				drag = true;
			}
			if (button == 2) {
				cameraPos.z += e.deltaY * 0.1;
				cameraPos.z = Math.min(cameraPos.z, -0.1);
				cameraPos.x += e.deltaX * 0.1;
			} else if (button == 1) {
				cameraPos.x += e.deltaX * 0.1;
				cameraPos.y -= e.deltaY * 0.1;
			} else {
				angleY += e.deltaX * 0.5;
				angleX = Math.max(-90, Math.min(90, angleX + e.deltaY * 0.5));
			}
		}
	};
}


// event
var button = -1;
var drag = false;
var dragX = 0, dragY = 0;


function node_by_pos(x, y) {
	var tracer = new GL.Raytracer();
	var ray = tracer.getRayForPixel(x, y);

	var min = 0;
	var target = null;
	var nodes = graph.nodes;
	for (var i=0; i<nodes.length; i++) {
		var node = nodes[i];
		result = GL.Raytracer.hitTestSphere(tracer.eye, ray, new GL.Vector(node.x, node.y, node.z) , 1.0);
		if (result && result.t > 0) {
			if (target == null || min > result.t ) {
				target = node;
				min = result.t;
			}
		}
	}
	return target;
}

function refresh() {
	var m;
	if (m  = location.search.match(/[\?&]procs=([\w-]+\.json)/)) {
		getJson(m[1], proc_loaded);
	} else if (m = location.search.match(/[\?&]node=([\w@\-\.]+)/)) {
		getJson("/nodes/" + m[1] + "/procs", proc_loaded);
	} else {
		// getJson("/nodes/_/procs", proc_loaded);
		getJson("/nodes?cluster=true&deep=true", on_nodes_result);
	}
}




window.addEventListener('load',(function(e){
	init_gl();
	gl.fullscreen();
	gl.animate();
	refresh();

	window.addEventListener('hashchange',(function(e){
		check_url_fragment();
	}),false);

	gl.canvas.addEventListener('contextmenu', function(e){
			e.preventDefault();
	});

	gl.canvas.addEventListener('touchstart', function(e){
		e.preventDefault();
		drag = true;
		button = e.targetTouches.length;
		dragX = e.targetTouches[0].clientX;
		dragY = e.targetTouches[0].clientY;
	});

	gl.canvas.addEventListener('click', function(e){
		if (drag) return;
		e.preventDefault();
		var target = node_by_pos(e.x, e.y);
		if (target) {
			console.log("click: " + target.name);
			selected = target;
			cameraPos.x = 0;
			cameraPos.y = 0;
			cameraPos.z = Math.max(-20, cameraPos.z);
		}
	});

	gl.canvas.addEventListener('dblclick', function(e){
		e.preventDefault();
		var target = node_by_pos(e.x, e.y);
		if (target && target == selected && target.type == 'proc') {
			console.log("dblclick: " + target.name);
			$('#proc_info_id').innerText=target.name;
			element_clear($('#proc_info_list'));
			element_append($('#proc_info_list'), [
				element('li', "initial_call:" + target.proc.initial_call),
				element('li', "trap_exit:" + target.proc.trap_exit),
				element('li', "heap size:" + target.proc.total_heap_size),
				element('li', "message queue:" + target.proc.message_queue_len)
			]);
			new Dialog($('#proc_info'), $('#proc_info_close')).
				onClick('proc_info_kill', function(){
					if (confirm('KILL ' + target.name + '?')) {
						var m = target.proc.id.match(/<([^:]*):(.*)>/);
						requestJson("DELETE", "nodes/" + m[1] + "/procs/" + m[2], refresh).send();
					}
				}).show();
		}
		if (target && target == selected && target.type == 'remote_proc') {
			location.href = "?node=" + target.node;
		}
		if (target && target == selected && target.type == 'node') {
			location.href = "?node=" + target.node;
		}
	});

	document.body.addEventListener('touchend', function(e){
		drag = false;
	});

	document.body.addEventListener('touchmove', function(e){
		if (drag) {
			if (button == 1) {
				cameraPos.x -= (e.targetTouches[0].clientX - dragX) * 0.01;
				cameraPos.y += (e.targetTouches[0].clientY - dragY) * 0.01;
			} else if (button == 2) {
				cameraPos.z -= (e.targetTouches[0].clientY - dragY) * 0.01;
				cameraPos.z = Math.max(cameraPos.z, 0.1);
			}
			dragX = e.targetTouches[0].clientX;
			dragY = e.targetTouches[0].clientY;
		}
	});

	gl.canvas.addEventListener('mousewheel', function(e){
		cameraPos.z += (e.wheelDelta || e.detail) * 0.01;
		cameraPos.z = Math.min(cameraPos.z, -0.1);
		e.preventDefault();
	});

	document.addEventListener('keydown', function(e){
		if (e.keyCode == 'R'.charCodeAt(0)) {
			refresh();
			new Toast(null, "Refresh...").show(2000);
		}
		if (e.keyCode == 'T'.charCodeAt(0)) {
			autoRotate = !autoRotate;;
			new Toast(null, "Rotation: " + autoRotate).show();
		}
		if (e.keyCode == 'Y'.charCodeAt(0)) {
			autoRefresh = !autoRefresh;;
			new Toast(null, "Polling: " + autoRefresh).show();
		}
		if (e.keyCode == 'W'.charCodeAt(0)) {
			cameraPos.z = Math.min(cameraPos.z + 0.5, -0.1);
		}
		if (e.keyCode == 'S'.charCodeAt(0)) {
			cameraPos.z = Math.max(cameraPos.z - 0.5, -150);
		}
		if (e.keyCode == 'A'.charCodeAt(0)) {
			angleY += 1.0;
		}
		if (e.keyCode == 'D'.charCodeAt(0)) {
			angleY -= 1.0;
		}
	});

}),false);
