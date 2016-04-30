
// nodes and edges
var size = 20;
var nodes = [];
var edges = [];
var procidx = {};
var search = "";
var defaultNodeColor = [0.6, 1.0, 1.0, 1.0];
var nodeTexSize = 256;

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
		// init nodes
		for (var i=0; i<nodes.length; i++) {
			var node = nodes[i];
			if (node.proc.initial_call.startsWith(search) || node.proc.registered_name && node.proc.registered_name.startsWith(search)) {
				node.color = [0, 1.0, 0, 1.0];
			} else {
				node.color = defaultNodeColor;
			}
		}

	}
	return false;
}

function proc_loaded(result) {
	if (result == null || result.status != 'ok') {
		console.log("proc_loaded status:" + result.status);
		return;
	}

	// console.time('proc_loaded');
	var oldnodes = nodes;
	var oldprocidx = procidx;
	nodes = [];
	edges = [];
	procidx = {};
	procs = result.processes;

	for (var i=0; i<procs.length; i++) {
		var proc = procs[i];
		if (!proc.alive) continue;
		procidx[proc.id] = nodes.length;
		nodes.push({type: "proc", name: proc.id, proc: proc, weight: 1.0, links: []});
	}
	
	for (var i=0; i<procs.length; i++) {
		var proc = procs[i];
		if (!proc.alive) continue;
		for (var j=0; j<proc.links.length; j++) {
			var l = proc.links[j];
			if (proc.id < l) {
				// console.log("link: " + proc.id + " <-> " + l);
				if (procidx[l]!=null && procidx[proc.id]!=null) {
					edges.push({from: procidx[proc.id], to: procidx[l], weight: 1.0, type: "link"});
					nodes[procidx[proc.id]].links.push(l);
					nodes[procidx[l]].links.push(proc.id);
				}
				
			}
		}
	
		for (var j=0; j<proc.monitors.length; j++) {
			var l = proc.monitors[j];
			// console.log("monitor: " + proc.id + " -> " + l);
			if (procidx[l]!=null && procidx[proc.id]!=null) {
				edges.push({from: procidx[proc.id], to: procidx[l], weight: 1.0, type: "monitor"});
			}
		}
	}

	var canvas = document.createElement("canvas");
	canvas.width  = nodeTexSize;
	canvas.height = nodeTexSize;
	var ctx = canvas.getContext("2d");


	// init nodes
	for (var i=0; i<nodes.length; i++) {
		var node = nodes[i];
		node.edges = [];

		if (oldprocidx[node.proc.id] != null ) {
			// restore old position.
			var oldnode = oldnodes[oldprocidx[node.proc.id]];
			node.x = oldnode.x;
			node.y = oldnode.y;
			node.z = oldnode.z;
			node.rot = oldnode.rot;
			if (node.proc.trap_exit == oldnode.proc.trap_exit && node.proc.registered_name == oldnode.proc.registered_name) {
				node.tex = oldnode.tex;
			}
		} else {
			node.x = Math.random() * size - size/2;
			node.y = Math.random() * size - size/2;
			node.z = Math.random() * size - size/2;
			node.rot = Math.random() * 360;
		}

		node.v = [0,0,0];
		node.color = defaultNodeColor;
		if (node.proc.message_queue_len > 0) {
			node.color = [1.0, 1.0, 0.3, 1.0];
		}
		if (node.tex == null) {
			ctx.clearRect(0, 0, nodeTexSize, nodeTexSize);
			ctx.font = "20px monospace";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillStyle = "white";
			circleText(ctx, node.proc.id, nodeTexSize/2, nodeTexSize/2, nodeTexSize*0.31, 0);
			var name = "";
			if (node.proc.registered_name && node.proc.registered_name.length>0) {
				name = node.proc.registered_name;
			} else {
				name = node.proc.initial_call || "";
			}
			circleText(ctx, name, nodeTexSize/2, nodeTexSize/2, nodeTexSize*0.38, Math.PI * 0.3);
			if (node.proc.trap_exit) {
				ctx.font = "10px monospace";
				circleText(ctx, "trap_exit", nodeTexSize/2, nodeTexSize/2, nodeTexSize*0.51, Math.PI * 0.2);
			}
			node.tex = GL.Texture.fromImage(canvas, {});
		}
	}

	// console.timeEnd('proc_loaded');

	for (var i=0; i<edges.length; i++) {
		var edge = edges[i];
		nodes[edge.from].edges.push(edge);
	}

	adjust_pos(20);
	check_url_fragment();

	// console.timeEnd('proc_loaded');
}

function adjust_pos(n) {
	// position
	for (var k=0; k<n; k++) {
		for (var i=0; i<nodes.length; i++) {
			var node = nodes[i];
			var f = [0.0,0.0,0.0];
			
			var dd = node.x*node.x + node.y*node.y + node.z*node.z;
			if (dd > 2.0) {
				f[0] += -node.x * 0.1 / dd;
				f[1] += -node.y * 0.1 / dd;
				f[2] += -node.z * 0.1 / dd;
			}
	
			for (var j=0; j<nodes.length; j++) {
				if (j == i) continue;
				var node2 = nodes[j];
				var d = [node.x - node2.x, node.y - node2.y, node.z - node2.z];
				var dd = d[0]*d[0] + d[1]*d[1] + d[2]*d[2] + 0.01;
				var dn = Math.sqrt(dd);
				var st = node.weight * node2.weight / dd * 0.2;
				f[0] += d[0] / dn * st;
				f[1] += d[1] / dn * st;
				f[2] += d[2] / dn * st;
			}
			for (var j=0; j<node.links.length; j++) {
				var idx = procidx[node.links[j]];
				if (idx == null || idx == i) continue;
				var node2 = nodes[idx];
				var d = [node.x - node2.x, node.y - node2.y, node.z - node2.z];
				var dn = Math.sqrt(d[0]*d[0] + d[1]*d[1] + d[2]*d[2]);
				var l = 1.0;
				var sk = 0.2 / Math.sqrt(node.links.length + node2.links.length);
				f[0] -= d[0] / dn * (dn-l) * sk;
				f[1] -= d[1] / dn * (dn-l) * sk;
				f[2] -= d[2] / dn * (dn-l) * sk;
			}
			node.v[0] *= 0.6;
			node.v[1] *= 0.6;
			node.v[2] *= 0.6;
			node.v[0] = f[0];
			node.v[1] = f[1];
			node.v[2] = f[2];
		}
		for (var i=0; i<nodes.length; i++) {
			var node = nodes[i];
			node.x += node.v[0];
			node.y += node.v[1];
			node.z += node.v[2];
		}
	}

	linklines.vertices = [];
	linklines.coords = [];
	linklines.lines = [];
	for (var i=0; i<edges.length; i++) {
		var edge = edges[i];
		var from = nodes[edge.from];
		var to = nodes[edge.to];
		var d = edge.type == "link" ? 0 : 0.5;
		linklines.vertices.push([from.x, from.y, from.z], [to.x, to.y, to.z]);
		linklines.coords.push([0,d], [1,d]);
		linklines.lines.push([i*2, i*2+1]);
	}
	linklines.compile();
}


// view
var gl = GL.create();
var linklines = new GL.Mesh({ coords: true, lines: true });

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

var mesh = GL.Mesh.plane({coords: true});

var vs = document.getElementById("vs").textContent;
var fs = document.getElementById("fs").textContent;
var shader = new GL.Shader(vs, fs);

var tex01 = GL.Texture.fromURL('images/node_circle.png');
var tex03 = GL.Texture.fromURL('images/node_selected.png');
var tex02 = GL.Texture.fromURL('images/link_tex.png');


gl.onupdate = function(seconds) {
	rot += 45 * seconds;
	adjust_pos(1);

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

	for (var i=0; i<nodes.length; i++) {
		var node = nodes[i];
		gl.pushMatrix();

		gl.translate(node.x, node.y, node.z);

		// billboard
		gl.rotate(-angleY, 0, 1, 0);
		gl.rotate(-angleX, 1, 0, 0);

		tex01.bind(0);
		gl.rotate(rot  + node.rot, 0, 0, 1);

		if (node == selected) {
			tex03.bind(1);
			shader.uniforms({
				texture: 1,
				color: [0,1,0,1]
			}).draw(mesh);
		}

		shader.uniforms({
			texture: 0,
			color: node.color
		}).draw(mesh);

		gl.pushMatrix();
		gl.scale(0.94, 0.94, 0.94);
		gl.rotate(-rot*1.6 + node.rot * 3, 0, 0, 1);
		shader.draw(mesh);
		gl.popMatrix();

		node.tex.bind(0);
		shader.draw(mesh);

		gl.popMatrix();
	}
	
	if (linklines.lines.length > 0) {
		tex02.bind(0);
		gl.lineWidth(2);
		shader.uniforms({
			texture: 0,
			color: [1.0, 1.0, 1.0, 1.0]
		}).draw(linklines,gl.LINES);
	}

};


// event
var button = 0;
var drag = false;
var dragX = 0, dragY = 0;

gl.onmousedown = function(e) {
	e.preventDefault();
	button = e.button;
	drag = false;
}

gl.onmousemove = function(e) {
	if (e.dragging) {
		if (e.deltaX*e.deltaX + e.deltaY * e.deltaY > 2) {
			drag = true;
		}
		if (button == 2) {
			cameraPos.z += e.deltaY * 0.1;
			cameraPos.z = Math.min(cameraPos.z, -0.1);
		} else if (button == 1) {
			cameraPos.x += e.deltaX * 0.1;
			cameraPos.y -= e.deltaY * 0.1;
		} else {
			angleY += e.deltaX * 0.5;
			angleX = Math.max(-90, Math.min(90, angleX + e.deltaY * 0.5));
		}
	}
};

function node_by_pos(x, y) {
	var tracer = new GL.Raytracer();
	var ray = tracer.getRayForPixel(x, y);

	var min = 0;
	var target = null;
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
	if (m  = location.search.match(/[\?&]procs=(\w+\.json)/)) {
		getJson(m[1], proc_loaded);
	} else if (m = location.search.match(/[\?&]node=([\w@\-\.]+)/)) {
		getJson("/nodes/" + m[1] + "/procs", proc_loaded);
	} else {
		getJson("/nodes/_/procs", proc_loaded);
	}
}




window.addEventListener('load',(function(e){
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
		if (target && target == selected) {
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
	});

}),false);