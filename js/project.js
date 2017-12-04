$(document).ready(function () {

    //Variable to keep track of user mode
    //TODO get permission based on login
    //1 = admin
    //2 = general user
    var userMode = 2;

    //webserver ip: 192.168.27.32
    //light1 ip: 192.168.27.31
    //light2 ip: 192.168.27.33
    //port: 5167
	
	var websocket = new WebSocket('ws://192.168.27.32:5167/');
    websocket.onopen = function () {
        console.log("Opening a connection...");
    };
	
    websocket.onmessage = function (e) {
		console.log("message recieved from server");
        console.log(e.data);
		
		//192.168.27.340T - on - ip_relaynum_status
		//192.168.27.340F - off
		invalidate();
    };


    var identity = 0;
    var mode;
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
	var lightImgLit;
    lightImgLit = new Image();
    lightImgLit.src = "images/builder/lighticonlit.png";

    var floorPlan;
    floorPlan = new Image();
    floorPlan.src = "images/tempFloorPlan.jpg";
	floorPlan.onload = function(){
		invalidate();
	}

    canvas.height = window.innerHeight * .80;
    canvas.width = window.innerWidth * .80;
    canvas.addEventListener("click", takeAction);
    ghostcanvas = document.createElement('canvas');
    ghostcanvas.height = canvas.height;
    ghostcanvas.width = canvas.width;
    gctx = ghostcanvas.getContext('2d');
    canvas.onmousedown = myAdminDown;
    canvas.onmouseup = myAdminUp;
    document.onkeydown = checkKey;

    //Enter info panel variables
    var enterInfo = document.getElementById('enterInfo');
    var ipInput = document.getElementById("ipInput");

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
	
	// fixes mouse co-ordinate problems when there's a border or padding
    // see getMouse for more detail
    if (document.defaultView && document.defaultView.getComputedStyle) {
        stylePaddingLeft = parseInt(document.defaultView.getComputedStyle(canvas, null)['paddingLeft'], 10) || 0;
        stylePaddingTop = parseInt(document.defaultView.getComputedStyle(canvas, null)['paddingTop'], 10) || 0;
        styleBorderLeft = parseInt(document.defaultView.getComputedStyle(canvas, null)['borderLeftWidth'], 10) || 0;
        styleBorderTop = parseInt(document.defaultView.getComputedStyle(canvas, null)['borderTopWidth'], 10) || 0;
    }

    function changeUser() {
        if (userMode == 1) {
            document.getElementById("floatingbar").hidden = false;
            document.getElementById("login").hidden = true;
            document.getElementById("accountInfo").hidden = false;
            document.getElementById("currentUser").val = document.getElementById("username").value;
            canvas.onmousedown = myAdminDown;
            canvas.onmouseup = myAdminUp;
        }
        else if (userMode == 2) {
            document.getElementById("floatingbar").hidden = true;
            document.getElementById("login").hidden = true;
            document.getElementById("accountInfo").hidden = false;
            document.getElementById("currentUser").val = document.getElementById("username").value;
            canvas.onmousedown = myDown;
            canvas.onmouseup = myUp;
            mode = "Mouse";
        }
    }

    function invalidate() {
        canvasValid = false;
    }

    function clear(context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
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

    function findBoxByName(id) {
        for (var i = boxes.length - 1; i >= 0; i--) {
            if (id == boxes[i].id) {
                return boxes[i];
            }
        }
        return null;
    }

    //Also sets mySel
    function isinbox(x, y) {
        clear(gctx); // clear the ghost canvas from its last use
        //Is it a box?
        for (var i = boxes.length - 1; i >= 0; i--) {
            drawshape2(gctx, boxes[i], 'black');

            // get image data at the mouse x,y pixel
            var imageData = gctx.getImageData(x, y, 1, 1);
            var index = (x + y * imageData.width) * 4;

            // if the mouse pixel exists
            if (imageData.data[3] > 0) {
                mySel = boxes[i];
                //Clear pane
                for (var qq = 0; qq < boxvars.length; qq++) {
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

    function isinline(x, y) {
        //Also sets mySel
        clear(gctx); // clear the ghost canvas from its last use
        //Is it a box?
        for (var i = boxes.length - 1; i >= 0; i--) {
            //Draw lines
            for (var j = 0; j < boxes[i].lines.length; j++) {
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

    function myDown(e) {
        getMouse(e);
        if (isinbox(mx, my)) {
            offsetx = mx - mySel.x;
            offsety = my - mySel.y;
            mySel.x = mx - offsetx;
            mySel.y = my - offsety;
			if(mySel.isLit) mySel.isLit = false;
			else mySel.isLit = true;
			var  connModule = findBoxByName(mySel.lines[0].toname);
			var lightNum = mySel.ip;
			var ipNum = connModule.ip;
            //do websocket here 
			//TODO2
            websocket.send("chainsaw" + lightNum + ipNum);

            console.log("chainsaw" + lightNum + ipNum);

            invalidate();
            return;
        }
            //Check if it exists as a line.
        else {
            clear(gctx);
        }
		
		
        mySel = null;// havent returned means we have selected nothing
        clear(gctx); // clear the ghost canvas for next time
        invalidate();// invalidate because we might need the selection border to disappear
    }

    function myUp() {
        isDrag = false;
        canvas.onmousemove = null;
    }

    function myAdminDown(e) {
        if (mode == "Mouse") {
            getMouse(e);
            if (isinbox(mx, my)) {
                offsetx = mx - mySel.x;
                offsety = my - mySel.y;
                mySel.x = mx - offsetx;
                mySel.y = my - offsety;
                isDrag = true;
                canvas.onmousemove = myMove;
                context.strokeStyle = mySelColor;
                context.lineWidth = mySelWidth;
                context.strokeRect(mySel.x, mySel.y, mySel.w, mySel.h);
                invalidate();
                return;
            }
                //Check if it exists as a line.
            else {
                clear(gctx);
            }
            mySel = null;// havent returned means we have selected nothing

            clear(gctx); // clear the ghost canvas for next time
            invalidate();// invalidate because we might need the selection border to disappear
        }
    }

    // Happens when the mouse is moving inside the canvas
    function myMove(e) {
        if (isDrag) {
            getMouse(e);
            mySel.x = mx - offsetx;
            mySel.y = my - offsety;
            mySel.midx = mySel.x + mySel.w / 2;
            mySel.midy = mySel.y + mySel.h / 2;
            invalidate();// something is changing position so we better invalidate the canvas!
        }
    }

    function myAdminUp() {
        isDrag = false;
        canvas.onmousemove = null;
    }

    function inspect(e) {
        getMouse(e);
        if (isinbox(mx, my)) {
			offsetx = mx - mySel.x;
            offsety = my - mySel.y;
            mySel.x = mx - offsetx;
            mySel.y = my - offsety;
            enterInfo.hidden = false;
            if (mySel.type == "module" || mySel.type == "server") {
				enterInfo_Module.hidden = false;
                ipInput.value = mySel.ip;
                context.strokeStyle = mySelColor;
                context.lineWidth = mySelWidth;
                context.strokeRect(mySel.x, mySel.y, mySel.w, mySel.h);
            }
            else if (mySel.type == "light") {
				enterInfo_Light.hidden = false;
                lightNumInput.value = mySel.ip;
                context.strokeStyle = mySelColor;
                context.lineWidth = mySelWidth;
                context.strokeRect(mySel.x, mySel.y, mySel.w, mySel.h);
            }
        }
		clear(gctx); // clear the ghost canvas for next time
        invalidate();// invalidate because we might need the selection border to disappear
    }

    function checkKey(e) {
        e = e || window.event;

        //Escape key pressed
        if (e.keyCode == 27) {
            if (mySel != null) {
                mySel = null;
                invalidate();
            }
        }

        //Delete key or backspace pressed when a pane is closed
        if (e.keyCode == 46 || e.keyCode == 8) {
            if (mySel != null && mode == "Mouse" && userMode == 1) {
				//remove edges connection to this box
				for(var j = 0; j < mySel.lines.length; j++){
					var tempBox = findBoxByName(mySel.lines[j].toname);
					for(var k = 0; k < tempBox.lines.length; k++){
						if (tempBox.lines[k].toname == mySel.id) tempBox.lines.splice(k, 1);
					}
				}
                boxes.splice(mySelIndex, 1);
                mySel = null;
                invalidate();
            }
        }
    }

    function takeAction(e) {
        if ("AddServer" == mode) {
            getMouse(e);
            var width = 32;
            var height = 32;
            addRect(mx - (width / 2), my - (height / 2), width, height, "server");
        }
        if ("AddModule" == mode) {
            getMouse(e);
            var width = 32;
            var height = 32;
            addRect(mx - (width / 2), my - (height / 2), width, height, "module");
        }
        if ("AddLight" == mode) {
            getMouse(e);
            var width = 32;
            var height = 32;
            addRect(mx - (width / 2), my - (height / 2), width, height, "light");
        }
        if ("Info" == mode) {
            inspect(e);
        }
    }

    function init_mode() {
        if ("Lines" == mode) {
            var started = false;
            var x0, y0;

            // This is called when you start holding down the mouse button.
            // This starts the pencil drawing.
            canvas.onmousedown = function (e) {
                getMouse(e);
                x0 = mx;
                y0 = my;

                if (isinbox(mx, my)) {
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
                    var source = mySel; //store original mySel
                    if (isinbox(mx, my) && source != mySel) { //set mySel to the destination box
                        source.lines.push(new Line(mySel.id));
						mySel.lines.push(new Line(source.id));
                    }
                }
                invalidate();
            }
        }
		
		else if ("Save" == mode) {
            saveLayout();
        }

        else {
            if (userMode == 1) {
                canvas.onmousedown = myAdminDown;
                canvas.onmouseup = myAdminUp;
                canvas.onmousemove = null;
            }
            else if (userMode == 2) {
                canvas.onmousedown = myDown;
                canvas.onmouseup = myUp;
                canvas.onmousemove = null;
            }
        }
    }
	
	/*///////////////////////////////////////////////////////
	/////////////////////Click Functions/////////////////////
	///////////////////////////////////////////////////////*/
	
	$("#loginButton").click(function () {
        var username1 = document.getElementById("username").value;
        var password1 = document.getElementById("password").value;
        if (username1 == "admin") userMode = 1;
        else userMode = 2;
        changeUser();
    });

    $("#switchUser").click(function () {
        if (userMode == 2) userMode = 1;
        else userMode = 2;
        changeUser();
		invalidate();
    });
	
	$("#load").click(function () {
        loadLayout();
    });
	
	$("#enterInfo_Button").click(function () {
        enterInfo.hidden = true;
        if (mySel.type == "module" || mySel.type == "server") {
			enterInfo_Module.hidden = true;
            mySel.ip = ipInput.value;
        }
        else if (mySel.type == "light") {
			enterInfo_Light.hidden = true;
            mySel.ip = lightNumInput.value;
        }
    });
	
	//Select image
    $('img').click(function () {
        $('.selected').removeClass('selected'); // removes the previous selected class
        $(this).addClass('selected'); // adds the class to the clicked image
        mode = document.querySelector('.selected').id;
        init_mode();
    });
	
	/*///////////////////////////////////////////////////////
	/////////////////////////Objects/////////////////////////
	///////////////////////////////////////////////////////*/
	
	//Object to store the different icons (server, module, or light)
    function Box() {
        this.type = "module";
        this.id = identity;
        this.ip = "";
        this.x = 0;
        this.y = 0;
        this.w = 1;
        this.h = 1;
        this.midx = this.x + this.w / 2;
        this.midy = this.y + this.h / 2;
        this.fill = '#444444';
        this.lines = []; //used for drawing lines and remebering connections
		this.isLit = false;
        identity += 1;
    }
	
	function Line(id) {
        this.type = "line";
        this.text = "";
        this.toname = id;
        this.istimeout = false;
    }
	
	/*///////////////////////////////////////////////////////
	/////////////////////Draw Functions//////////////////////
	///////////////////////////////////////////////////////*/
	
	// While draw is called as often as the INTERVAL variable demands,
    // It only ever does something if the canvas gets invalidated by our code
    function draw() {

        if (canvasValid == false) {
            clear(context);

            justDraw();

            // Add stuff drawn on top here
            canvasValid = true;
        }
    }
	
	function justDraw() {

        //Draw Background
        context.globalAlpha = 0.5;
        if (floorPlan){
			//Draw the floorplan with the correct aspect ration
			drawImageScaled(floorPlan, context);
		}
        context.globalAlpha = 1;

        // draw all boxes
        for (var i = 0; i < boxes.length; i++) {
            //Draw all lines
			if(userMode == 1){
				context.globalAlpha = 0.5;
				for (var j = 0; j < boxes[i].lines.length; j++) {
					var source = boxes[i];
					var dest = findBoxByName(source.lines[j].toname);
					context.beginPath();
					context.moveTo(source.midx, source.midy);
					context.lineTo(dest.midx, dest.midy);
					if (source.lines[j].istimeout) {
						context.strokeStyle = '#000000';
					} else {
						context.strokeStyle = '#000000';
					}
					context.lineWidth = 2;
					context.stroke();
					context.closePath();
				}
				context.globalAlpha = 1;
				//draw the box
				drawshape(context, boxes[i]);
			}
			else{
				context.globalAlpha = 1;
				//draw the box
				if(boxes[i].type == "light")drawshape(context, boxes[i]);
			}
        }

        // draw selection
        // right now this is just a stroke along the edge of the selected box
        if (mySel != null && userMode == 1) {
            context.strokeStyle = mySelColor;
            context.lineWidth = mySelWidth;
            context.strokeRect(mySel.x, mySel.y, mySel.w, mySel.h);
        }
    }
	
	// Draws a single shape to a single context
    // justDraw() will call this with the normal canvas
    // myDown will call this with the ghost canvas
    function drawshape(context, shape) {

        // We can skip the drawing of elements that have moved off the screen:
        if (shape.x > canvas.width || shape.y > canvas.height) return;
        if (shape.x + shape.w < 0 || shape.y + shape.h < 0) return;

        if (shape.type == "server") {
            if (serverImg) context.drawImage(serverImg, shape.x, shape.y, shape.w, shape.h);
        }
        if (shape.type == "module") {
            if (moduleImg) context.drawImage(moduleImg, shape.x, shape.y, shape.w, shape.h);
        }
        if (shape.type == "light") {
            if (lightImg){
				if(!shape.isLit) context.drawImage(lightImg, shape.x, shape.y, shape.w, shape.h);
				else context.drawImage(lightImgLit, shape.x, shape.y, shape.w, shape.h);
			}
        }

    }

    function drawshape2(context, shape, fill) {
        context.fillStyle = fill;

        // We can skip the drawing of elements that have moved off the screen:
        if (shape.x > canvas.width || shape.y > canvas.height) return;
        if (shape.x + shape.w < 0 || shape.y + shape.h < 0) return;
        context.fillRect(shape.x, shape.y, shape.w, shape.h);
    }
	
	//draw image to context with correct aspect ratio
	function drawImageScaled(img, ctx) {
		var canvas = ctx.canvas ;
		var hRatio = canvas.width  / img.width    ;
		var vRatio =  canvas.height / img.height  ;
		var ratio  = Math.min ( hRatio, vRatio );
		var centerShift_x = ( canvas.width - img.width*ratio ) / 2;
		var centerShift_y = ( canvas.height - img.height*ratio ) / 2;  
		ctx.clearRect(0,0,canvas.width, canvas.height);
		ctx.drawImage(img, 0,0, img.width, img.height,
                      centerShift_x,centerShift_y,img.width*ratio, img.height*ratio);  
	}
	
	/*///////////////////////////////////////////////////////
	/////////////////Save and Load Functions/////////////////
	///////////////////////////////////////////////////////*/
	
	function saveLayout(){
		
		//iterate through box list and push config if it's a module/server
		for(var k = 0; k < boxes[i].length; k++){
			if(boxes[k].type == "module"){
				//var config = "[comm|port|5167|call|chainsaw|][pins|but1|7|but2|13|relay1|11|relay2|16|][configs|debug|1|]"
				//websocket.send(config);
			}
		}
		
		//write json of boxes to storage file (positions too)
		console.log( "Saving Data");
		var data = JSON.stringify( boxes );
		var fileName = "floorData.fd";
		var a = document.createElement("a");
		document.body.appendChild(a);
		a.style = "display: none";  
		var json = JSON.stringify(data);
		blob = new Blob([json], {type: "octet/stream"});
		url = window.URL.createObjectURL(blob);
		a.href = url;
		a.download = fileName;
		a.click();
		window.URL.revokeObjectURL(url);
	}
	
	function loadLayout(){
		
		input = document.getElementById('fileinput');
		
		file = input.files[0];
		fr = new FileReader();
		fr.onload = receivedText;
		fr.readAsText(file);
	
		function receivedText(e) {
			lines = e.target.result;
			var newArr = JSON.parse(JSON.parse(lines));
			boxes = newArr;
			
			//set id properly
			var maxID = 0;
			for(var k=0; k < boxes.length; k++){
				if(boxes[k].id > maxID) maxID = boxes[k].id;
			}
			identity = maxID+1;
		}
		
		//tell program to redraw
		invalidate();
		
	}

});