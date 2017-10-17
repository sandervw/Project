$(document).ready(function(){

	//Variable to keep track of user mode
	//TODO get permission based on login
	//1 = admin
	//2 = general user
	var userMode = 1;
	
	var websocket = new WebSocket("server address");

	var mode;
	var roomnum = 1;
	var boxes = [];
	var isDrag = false;
	var canvas = document.getElementById("canvas");
	var context = canvas.getContext("2d");
	var ghostcanvas;// we use a fake canvas to draw individual shapes for selection testing
	var gctx; // fake canvas context
	
	var serverImg;
	serverImg = new Image();
	serverImg.src = "images/builder/servericon.png";
	var moduleImg;
	moduleImg = new Image();
	moduleImg.src = "images/builder/moduleicon.png";
	var lightImg;
	lightImg = new Image();
	lightImg.src = "images/builder/lighticon.png";
	
	var floorPlan;
	floorPlan = new Image();
	floorPlan.src = "images/tempFloorPlan.jpg";
	
	canvas.height = window.innerHeight*.80;
	canvas.width = window.innerWidth*.80;
	canvas.addEventListener("click", takeAction);
	ghostcanvas = document.createElement('canvas');
	ghostcanvas.height = canvas.height;
	ghostcanvas.width = canvas.width;
	gctx = ghostcanvas.getContext('2d');
	canvas.onmousedown = myDown;
	canvas.onmouseup = myUp;
	document.onkeydown = checkKey;
	
	//
	var boxvars = [];//Used to clear vars between clicks.
	
	//fixes a problem where double clicking causes text to get selected on the canvas
    canvas.onselectstart = function () { return false; }
	
	// when set to true, the canvas will redraw everything
	// invalidate() just sets this to false right now
	// we want to call invalidate() whenever we make a change
	var canvasValid = false;
	var INTERVAL = 20;  // how often, in milliseconds, we check to see if a redraw is needed	
	// make draw() fire every INTERVAL milliseconds.
	setInterval(draw, INTERVAL);
	var myboxcolor = '#000000'
	
	// The node (if any) being selected.
	var mySel;
	var mySelIndex;
	// The selection color and width. Right now we have a red selection with a small width
	var mySelColor = '#CC0000';
	var mySelWidth = 2;
	
	// since we can drag from anywhere in a node instead of just its x/y corner, we need to save
	// the offset of the mouse when we start dragging.
	var offsetx, offsety;
	
	// Padding and border style widths for mouse offsets
	var stylePaddingLeft, stylePaddingTop, styleBorderLeft, styleBorderTop;
	var mx, my; //Used for mouse positions
	
	var exportboxes = {};
	
	$("#loginButton").click(function(){
		var username1 = document.getElementById("username").value;
		var password1 = document.getElementById("password").value;
		if(username1 == "admin") userMode = 1;
		else userMode = 2;
		changeUser();
	});
	
	$("#switchUser").click(function(){
		if(userMode == 2) userMode = 1;
		else userMode = 2;
		changeUser();
	});
	
	function changeUser(){
		if(userMode == 1){
			document.getElementById("floatingbar").hidden = false;
			document.getElementById("login").hidden = true;
			document.getElementById("accountInfo").hidden = false;
			document.getElementById("currentUser").val = document.getElementById("username").value;
			canvas.onmousedown = myAdminDown;
			canvas.onmouseup = myAdminUp;
		}
		else if(userMode == 2){
			document.getElementById("floatingbar").hidden = true;
			document.getElementById("login").hidden = true;
			document.getElementById("accountInfo").hidden = false;
			document.getElementById("currentUser").val = document.getElementById("username").value;
			canvas.onmousedown = myDown;
			canvas.onmouseup = myUp;
		}
	}
	
	function invalidate() {
		canvasValid = false;
	}
	
	function clear(context){
		context.clearRect(0, 0, canvas.width, canvas.height);
	}	
	
	function Box(){
		this.type = "module";
		this.name = "room" + roomnum;
		this.x = 0;
		this.y = 0;
		this.w = 1; 
		this.h = 1;
		this.midx = this.x + this.w / 2;
		this.midy = this.y + this.h / 2;		
		this.fill = '#444444';
		this.lines = [];
		
		roomnum = roomnum + 1;
	}
	
	function addRect(x, y, w, h, type) {
		var rect = new Box;
		rect.type = type;
		rect.x = x;
		rect.y = y;
		rect.w = w
		rect.h = h;
		rect.midx = rect.x + rect.w / 2;
		rect.midy = rect.y + rect.h / 2;
		boxes.push(rect);
		invalidate();
	}
	
	function Line(name){
		this.type = "line";
		this.text = "";
		this.toname = name;
		this.istimeout = false;
	}
	
	function getMousePos(canvas, evt) {
		var rect = canvas.getBoundingClientRect();
		return {
		x: evt.clientX - rect.left,
		y: evt.clientY - rect.top
		};
	}
	
	// Sets mx,my to the mouse position relative to the canvas
	// unfortunately this can be tricky, we have to worry about padding and borders
	function getMouse(e) {
		var element = canvas, offsetX = 0, offsetY = 0;

		if (element.offsetParent) {
			do {
			  offsetX += element.offsetLeft;
			  offsetY += element.offsetTop;
			} while ((element = element.offsetParent));
		}

		// Add padding and border style widths to offset
		offsetX += stylePaddingLeft;
		offsetY += stylePaddingTop;

		offsetX += styleBorderLeft;
		offsetY += styleBorderTop;

		mx = e.pageX - offsetX;
		my = e.pageY - offsetY
	}

	function findBoxByName(name){
		for (var i = boxes.length-1; i >= 0; i--) {
			if(name == boxes[i].name){
				return boxes[i];
			}
		}
		return null;
	}
	
	// fixes mouse co-ordinate problems when there's a border or padding
	// see getMouse for more detail
	if (document.defaultView && document.defaultView.getComputedStyle) {
		stylePaddingLeft = parseInt(document.defaultView.getComputedStyle(canvas, null)['paddingLeft'], 10) || 0;
		stylePaddingTop  = parseInt(document.defaultView.getComputedStyle(canvas, null)['paddingTop'], 10)  || 0;
		styleBorderLeft  = parseInt(document.defaultView.getComputedStyle(canvas, null)['borderLeftWidth'], 10)  || 0;
		styleBorderTop   = parseInt(document.defaultView.getComputedStyle(canvas, null)['borderTopWidth'], 10)   || 0;
	}
	
	// Draws a single shape to a single context
	// draw() will call this with the normal canvas
	// myDown will call this with the ghost canvas
	function drawshape(context, shape) {
	  
	  // We can skip the drawing of elements that have moved off the screen:
	  if (shape.x > canvas.width || shape.y > canvas.height) return; 
	  if (shape.x + shape.w < 0 || shape.y + shape.h < 0) return;
	  
	  if(shape.type == "server"){
		  if(serverImg) context.drawImage(serverImg,shape.x,shape.y,shape.w,shape.h);
	  }
	  if(shape.type == "module"){
		  if(moduleImg) context.drawImage(moduleImg,shape.x,shape.y,shape.w,shape.h);
	  }
	  if(shape.type == "light"){
		  if(lightImg) context.drawImage(lightImg,shape.x,shape.y,shape.w,shape.h);
	  }
	  
	}
	
	function drawshape2(context, shape, fill) {
	  context.fillStyle = fill;
	  
	  // We can skip the drawing of elements that have moved off the screen:
	  if (shape.x > canvas.width || shape.y > canvas.height) return; 
	  if (shape.x + shape.w < 0 || shape.y + shape.h < 0) return;
	  console.log("got here");
	  context.fillRect(shape.x,shape.y,shape.w,shape.h);
	}
	
	//Also sets mySelf
	function isinbox(x, y){
		clear(gctx); // clear the ghost canvas from its last use
		//Is it a box?
		for (var i = boxes.length-1; i >= 0; i--) {
			drawshape2(gctx, boxes[i], 'black');

			// get image data at the mouse x,y pixel
			var imageData = gctx.getImageData(x, y, 1, 1);
			var index = (x + y * imageData.width) * 4;

			// if the mouse pixel exists
			if (imageData.data[3] > 0) {
				mySel = boxes[i];
				//Clear pane
				for(var qq = 0; qq < boxvars.length; qq++){
					boxvars[qq].value = "";
					boxvars[qq].checked = false
				}
				mySelIndex = i;
				clear(gctx);
				return true;
			}
		}
		return false;
	}
	
	function isinline(x, y){
		//Also sets mySel
		clear(gctx); // clear the ghost canvas from its last use
		//Is it a box?
		for (var i = boxes.length-1; i >= 0; i--) {
			//Draw lines
			for(var j = 0; j < boxes[i].lines.length; j++){
				//drawshape(gctx, boxes[i], 'black');
				//Draw all lines
					var source = boxes[i];
					var dest = findBoxByName(source.lines[j].toname);
					gctx.beginPath();
					gctx.moveTo(source.midx, source.midy);
					gctx.lineTo(dest.midx, dest.midy);
					gctx.strokeStyle = '#000000';
					gctx.lineWidth = 10;
					gctx.stroke();		
					gctx.closePath();
					
					// get image data at the mouse x,y pixel
					var imageData = gctx.getImageData(x, y, 1, 1);
					var index = (x + y * imageData.width) * 4;

					// if the mouse pixel exists
					if (imageData.data[3] > 0) {
						mySel = boxes[i].lines[j];
						mySelIndex = i;
						clear(gctx);
						return true;
					}
				}
			}
			return false;
		}
	
	function myDown(e){
	  getMouse(e);
	  if(isinbox(mx, my)){
		  offsetx = mx - mySel.x;
		  offsety = my - mySel.y;
		  mySel.x = mx - offsetx;
		  mySel.y = my - offsety;
		  
		  //do websocket here 
		  
		  
		  invalidate();
		  return;
		}
		//Check if it exists as a line.
		else{
			clear(gctx);
		}
		mySel = null;// havent returned means we have selected nothing
		clear(gctx); // clear the ghost canvas for next time
		invalidate();// invalidate because we might need the selection border to disappear
	}

	function myUp(){
	}
	
	function myAdminDown(e){
	  if(mode == "Mouse"){
		  getMouse(e);
		  if(isinbox(mx, my)){
			  offsetx = mx - mySel.x;
			  offsety = my - mySel.y;
			  mySel.x = mx - offsetx;
			  mySel.y = my - offsety;
			  isDrag = true;
			  canvas.onmousemove = myMove;
			  invalidate();
			  return;
			}
			//Check if it exists as a line.
			else{
				clear(gctx);
			}
			mySel = null;// havent returned means we have selected nothing

			clear(gctx); // clear the ghost canvas for next time
			invalidate();// invalidate because we might need the selection border to disappear
		}
	}

	// Happens when the mouse is moving inside the canvas
	function myMove(e){
	  if (isDrag){
		getMouse(e);
		mySel.x = mx - offsetx;
		mySel.y = my - offsety;
		mySel.midx = mySel.x + mySel.w / 2;
		mySel.midy = mySel.y + mySel.h / 2;
		invalidate();// something is changing position so we better invalidate the canvas!
	  }
	}

	function myAdminUp(){
	  isDrag = false;
	  canvas.onmousemove = null;
	}
	
	function justDraw(){
		
		//draw BG
		context.globalAlpha = 0.5;
		if(floorPlan) context.drawImage(floorPlan,0,0,canvas.width *(floorPlan.width/floorPlan.height),canvas.height);
		context.globalAlpha = 1;
		
		// draw all boxes
		for (var i = 0; i < boxes.length; i++) {
			drawshape(context, boxes[i]);
			//Draw all lines
			for(var j = 0; j < boxes[i].lines.length; j++){
				var source = boxes[i];
				var dest = findBoxByName(source.lines[j].toname);
				context.beginPath();
				context.moveTo(source.midx, source.midy);
				context.lineTo(dest.midx, dest.midy);
				if(source.lines[j].istimeout){
					context.strokeStyle = '#000000';
				}else{
					context.strokeStyle = '#000000';
				}
				context.lineWidth = 3;
				context.stroke();		
				context.closePath();
			}
		}
			
		// draw selection
		// right now this is just a stroke along the edge of the selected box
		if (mySel != null) {
			context.strokeStyle = mySelColor;
			context.lineWidth = mySelWidth;
			context.strokeRect(mySel.x,mySel.y,mySel.w,mySel.h);
		}
	}
		
	// While draw is called as often as the INTERVAL variable demands,
	// It only ever does something if the canvas gets invalidated by our code
	function draw() {
		
	  if (canvasValid == false) {
			clear(context);

			// Add stuff drawn in background here:
			context.globalAlpha = 0.5;
			if(floorPlan) context.drawImage(floorPlan,0,0,canvas.width *(floorPlan.width/floorPlan.height),canvas.height);
			context.globalAlpha = 1;
			justDraw();

			// Add stuff drawn on top here
			canvasValid = true;
		}
	}

	function checkKey(e) {
		e = e || window.event;

		//Escape key pressed
		if(e.keyCode == 27) {
			if(mySel != null){
				mySel = null;
				invalidate();
			}
		}
		
		//Delete key or backspace pressed when a pane is closed
		if(e.keyCode == 46 || e.keyCode == 8) {
			if(mySel != null){
				boxes.splice(mySelIndex, 1);
				mySel = null;
				invalidate();
			}
		}
	}

	function takeAction(e){
		if("AddServer" == mode){
			getMouse(e);
			var width = 32;
			var height = 32;
			addRect(mx - (width / 2), my - (height / 2), width, height, "server");
		}
		if("AddModule" == mode){
			getMouse(e);
			var width = 32;
			var height = 32;
			addRect(mx - (width / 2), my - (height / 2), width, height, "module");
		}
		if("AddLight" == mode){
			getMouse(e);
			var width = 32;
			var height = 32;
			addRect(mx - (width / 2), my - (height / 2), width, height, "light");
		}
		else if("Info" == mode){
			inspect(e);
		}
		else if("Save" == mode){
			save();
		}
	}
	
	//make tile
	var tile = function(name, scenariotext, options, time, imgpath, onExpireName, pointval, isFinal){
		this.name = name;//Tile name, globally unique
		this.scenariotext = scenariotext; //The quesiton displayed
		this.options = options; //List of buttons (text, next tile) that give choices
		this.time = time; //Amount of time to react
		this.img = imgpath; //The image to display
		this.onExpireName = onExpireName; //name of the tile to load if no action is taken. Usually gameover.
		if(pointval)
		{
		this.pointval = pointval; //Points this tile is worth 
		}
		else
		{
			this.pointval = 10;//Default point val
		}
		this.isFinal = isFinal;
		
		exportboxes[name] = this;//Add to global map
		console.log( "New tile added")
		console.log(this);
	}
	
	//Display text should appear on a button
	var nxttile = function(nextname, displaytext)
	{
		this.nextname = nextname;
		this.displaytext = displaytext;
	}
	
	function save(){
		//Name it appropraitely
		for(var i = 0; i < boxes.length; i++){
			if(boxes[i].startroom){
					boxes[i].name = "start_room";
				}
		}
	
		//Check name
		for(var i = 0; i < boxes.length; i++){
			var nxts = [];
		
			//Populate nexttiles
			for(var j = 0; j < boxes[i].lines.length; j++)
			{
				nxts.push(new nxttile(boxes[i].lines[j].toname, boxes[i].lines[j].text));
			}
			new tile(boxes[i].name, boxes[i].scentext, nxts, boxes[i].time, boxes[i].imgpath, boxes[i].expirename, parseInt(boxes[i].points, 10), boxes[i].isFinal); 
			console.log(exportboxes);
		}
		
		//Now save it all
		console.log( "export boxes: ")
		console.log( exportboxes);
		var data = JSON.stringify( exportboxes );
		var fileName = "my-story.story";
		var a = document.createElement("a");
		document.body.appendChild(a);
		a.style = "display: none";
		console.log( data);
		console.log( fileName)      
		  var json = JSON.stringify(data),
				blob = new Blob([json], {type: "octet/stream"}),
				url = window.URL.createObjectURL(blob);
			a.href = url;
			a.download = fileName;
			a.click();
			window.URL.revokeObjectURL(url);
		}
	
	function init_mode(){
		if("Lines" == mode){
			var started = false;
			var x0, y0;
			
			 // This is called when you start holding down the mouse button.
			// This starts the pencil drawing.
			canvas.onmousedown = function (e) {
				getMouse(e);
				x0 = mx;
				y0 = my;
				
				if(isinbox(mx, my)){
					started = true;
				}
			};

			canvas.onmousemove = function (e) {
			if (!started) {
				return;
			  }
			  if (started) {
			  context.clearRect(0, 0, canvas.width, canvas.height);
				//invalidate();
				
				justDraw()
				
				getMouse(e);
				context.beginPath();
				context.moveTo(x0, y0);
				context.lineTo(mx, my);
				context.strokeStyle = '#FF00FF';
				context.lineWidth = 1;
				context.stroke();		
				context.closePath();
			 }
			};

			// This is called when you release the mouse button.
			canvas.onmouseup = function (e) {
				 if (started) {
					started = false;
					getMouse(e);
					var source = mySel;
					if(isinbox(mx, my) && source != mySel){
						source.lines.push(new Line(mySel.name));
					}
				}
				invalidate();
			}
		}
		
		else{
			canvas.onmousedown = myDown;
			canvas.onmouseup = myUp;
			canvas.onmousemove = null;
		}
	}
		
	//Select image
	$('img').click(function(){
		$('.selected').removeClass('selected'); // removes the previous selected class
		$(this).addClass('selected'); // adds the class to the clicked image
		mode = document.querySelector('.selected').id;
		init_mode();
	});	 

});