///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 - 2016 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
		'dojo/_base/declare',
		'dojo/_base/lang',
		'dojo/aspect',
		"dojo/on",
		'dojo/Deferred',
		'dijit/_WidgetsInTemplateMixin',
		'jimu/BaseWidget',
		'jimu/portalUtils',
		'jimu/dijit/Message',
		'esri/units',
		'esri/dijit/Measurement',
		"esri/symbols/jsonUtils",
		"esri/symbols/SimpleMarkerSymbol",
		"esri/symbols/SimpleLineSymbol",
		"esri/symbols/SimpleFillSymbol",
		"esri/symbols/TextSymbol",
		"esri/toolbars/draw",
		"esri/geometry/Point",
		"esri/graphic",
		"esri/Color",
		"esri/symbols/Font",
		"esri/tasks/GeometryService",
		"esri/tasks/AreasAndLengthsParameters",
		"esri/tasks/LengthsParameters"
	],
	function(
		declare,
		lang,
		aspect,
		on,
		Deferred,
		_WidgetsInTemplateMixin,
		BaseWidget,
		PortalUtils,
		Message,
		esriUnits,
		Measurement,
		jsonUtils,
		SimpleMarkerSymbol,
		SimpleLineSymbol,
		SimpleFillSymbol,
		TextSymbol,
		Draw,
		Point,
		Graphic,
		Color,
		Font,
		GeometryService,
		AreasAndLengthsParameters,
		LengthsParameters) {
		var clazz = declare([BaseWidget, _WidgetsInTemplateMixin], {

			name: 'Measurement',
			baseClass: 'jimu-widget-measurement',
			measurement: null,
			_pcDef: null,

			startup: function() {
				if(this.measurement || this._pcDef) {
					return;
				}
				this.inherited(arguments);
				//创建几何服务对象
				var geometryServices = new GeometryService("http://112.4.212.98:6080/arcgis/rest/services/Utilities/Geometry/GeometryServer");

				//使用toolbar上的绘图工具
				var toolBar = new Draw(this.map);
				var lineSymbol = new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color([0, 128, 238]), 3);
				var gonSymbol = new esri.symbol.SimpleFillSymbol(esri.symbol.SimpleFillSymbol.STYLE_SOLID, lineSymbol, new dojo.Color([0, 128, 238, 0.25]));
				toolBar.lineSymbol = lineSymbol;
				toolBar.fillSymbol = gonSymbol;
				var area = document.getElementById("btn_area");
				var length = document.getElementById("btn_length");
				var handArea = document.getElementById("btn_refershHandArea");
				var self = this;
				area.onclick = function() {
					//绘图开始，使弹窗失效
					try{
					var popS = document.getElementsByClassName("esriPopupMobile")[0];
					popS.className = 'popNone';
					}catch (e){
						try{
							var popS = document.getElementsByClassName("esriPopup")[0];
							popS.className = 'popNones';
						}catch(e){}
					};
				
					self.map.graphics.clear();
					toolBar.activate(Draw.POLYGON, {
						showTooltips: true
					})
				};

				length.onclick = function() {
					//绘图开始，使弹窗失效
					try{
					var popS = document.getElementsByClassName("esriPopupMobile")[0];
					popS.className = 'popNone';
					}catch (e){
						try{
							var popS = document.getElementsByClassName("esriPopup")[0];
							popS.className = 'popNones';
						}catch(e){}
					};
					self.map.graphics.clear();
					toolBar.activate(Draw.POLYLINE, {
						showTooltips: true
					})
				};
				//绘制徒手面
				handArea.onclick = function () {
					//绘图开始，使弹窗失效
					try{
					var popS = document.getElementsByClassName("esriPopupMobile")[0];
					popS.className = 'popNone';
					}catch (e){
						try{
							var popS = document.getElementsByClassName("esriPopup")[0];
							popS.className = 'popNones';
						}catch(e){}
					};
					self.map.graphics.clear();
					toolBar.activate(Draw.FREEHAND_POLYGON, {
						showTooltips:true
					})
				};

				//绘图结束绑定事件
				on(toolBar, "draw-end", function(result) {
					//获得面形状
					var geometry = result.geometry;
					doMeasure(geometry);
					toolBar.deactivate();
				})

				//量算
				function doMeasure(geometry) {
					//更加类型设置显示样式
					measuregeometry = geometry;
					switch(geometry.type) {
						case "polyline":
							var symbol = new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color([0, 128, 238]), 3);
							break;
						case "polygon":
							var symbol = new esri.symbol.SimpleFillSymbol(esri.symbol.SimpleFillSymbol.STYLE_SOLID, new esri.symbol.SimpleLineSymbol(esri.symbol.SimpleLineSymbol.STYLE_SOLID, new dojo.Color([0, 128, 238]), 3), new dojo.Color([255, 255, 0, 0.25]));
							break;
					}
					//设置样式
					var graphic = new esri.Graphic(geometry, symbol);
					//清除上一次的画图内容
					self.map.graphics.clear();
					self.map.graphics.add(graphic);
					//进行投影转换，完成后调用projectComplete
					MeasureGeometry(geometry);
				}

				//投影转换完成后调用方法
				function MeasureGeometry(geometry) {
					//如果为线类型就进行lengths距离测算
					if(geometry.type == "polyline") {
						var lengthParams = new esri.tasks.LengthsParameters();
						lengthParams.polylines = [geometry];
						lengthParams.lengthUnit = esri.tasks.GeometryService.UNIT_METER;
						lengthParams.geodesic = true;
						lengthParams.polylines[0].spatialReference = new esri.SpatialReference(2364);
						geometryServices.lengths(lengthParams);
						dojo.connect(geometryServices, "onLengthsComplete", outputDistance);
					}
					//如果为面类型需要先进行simplify操作在进行面积测算
					else if(geometry.type == "polygon") {
						var areasAndLengthParams = new esri.tasks.AreasAndLengthsParameters();
						areasAndLengthParams.lengthUnit = esri.tasks.GeometryService.UNIT_METER;
						areasAndLengthParams.areaUnit = esri.tasks.GeometryService.UNIT_SQUARE_METERS;
						geometryServices.simplify([geometry], function(simplifiedGeometries) {
							areasAndLengthParams.polygons = simplifiedGeometries;
							geometryServices.areasAndLengths(areasAndLengthParams);
						});
						dojo.connect(geometryServices, "onAreasAndLengthsComplete", outputAreaAndLength);

					}
				}

				//显示测量距离
				function outputDistance(result) {
					var text = result.lengths[0].toFixed(2) + '米';
					var x=measuregeometry.paths[0][measuregeometry.paths[0].length-1][0];
					var y=measuregeometry.paths[0][measuregeometry.paths[0].length-1][1];
					var point=new Point(x,y);
					
					var textSym = new TextSymbol(text);
					textSym.setHaloColor(new Color([255, 255, 255]));
					textSym.setHaloSize(1);
					textSym.setOffset(10,-20)
					textSym.setColor(new Color([0,0,0]));
					var font=new Font();
					font.setSize("12pt");
					font.setWeight(Font.WEIGHT_BOLD);
					textSym.setFont(font);
					var graphic = new esri.Graphic(point, textSym);
					self.map.graphics.add(graphic);
					try{
						document.getElementsByClassName("titleButton close")[0].click();
						var popS = document.getElementsByClassName("popNone")[0];
						popS.className = 'esriPopupMobile';
					} catch (e){
						try{
							var popS = document.getElementsByClassName("popNones")[0];
							popS.className = 'esriPopup esriPopupHidden';
						}catch (e){};
					};
				}

				//显示测量面积
				function outputAreaAndLength(result) {
					var text = result.areas[0].toFixed(1) + '平方米\n     ' + (result.areas[0] / 666.7).toFixed(2) + ' 亩\n' + (result.areas[0] / 10000).toFixed(2) + ' 公顷';
					var textSym = new TextSymbol(text,color,font);
					textSym.setHaloColor(new Color([255, 255, 255]));
					textSym.setHaloSize(1);
					var color=new Color();
					textSym.setColor(new Color([0,0,0]));
					var font=new Font();
					font.setSize("12pt");
					font.setWeight(Font.WEIGHT_BOLD);
					textSym.setFont(font);
					var graphic = new esri.Graphic(measuregeometry, textSym);
					self.map.graphics.add(graphic);
					try{
						document.getElementsByClassName("titleButton close")[0].click();
						var popS = document.getElementsByClassName("popNone")[0];
						popS.className = 'esriPopupMobile';
					} catch (e){
						try{
							var popS = document.getElementsByClassName("popNones")[0];
							popS.className = 'esriPopup esriPopupHidden';
						}catch (e){};
					};
				}

				var json = this.config.measurement;
				json.map = this.map;
				if(json.lineSymbol) {
					json.lineSymbol = jsonUtils.fromJson(json.lineSymbol);
				}
				if(json.pointSymbol) {
					json.pointSymbol = jsonUtils.fromJson(json.pointSymbol);
				}

				this._processConfig(json).then(lang.hitch(this, function(measurementJson) {
					this.measurement = new Measurement(measurementJson, this.measurementDiv);
					this.own(aspect.after(this.measurement, 'setTool', lang.hitch(this, function() {
						if(this.measurement.activeTool) {

							this.disableWebMapPopup();
						} else {
							this.enableWebMapPopup();
						}
					})));

					this.measurement.startup();

					this._hideToolsByConfig();
				}), lang.hitch(this, function(err) {
					new Message({
						message: err.message || err
					});
				}));
			},

			_processConfig: function(configJson) {
				this._pcDef = new Deferred();
				if(configJson.defaultLengthUnit && configJson.defaultAreaUnit) {
					this._pcDef.resolve(configJson);
				} else {
					PortalUtils.getUnits(this.appConfig.portalUrl).then(lang.hitch(this, function(units) {
						configJson.defaultAreaUnit = units === 'english' ?
							esriUnits.SQUARE_MILES : esriUnits.SQUARE_KILOMETERS;
						configJson.defaultLengthUnit = units === 'english' ?
							esriUnits.MILES : esriUnits.KILOMETERS;
						this._pcDef.resolve(configJson);
					}), lang.hitch(this, function(err) {
						console.error(err);
						configJson.defaultAreaUnit = esriUnits.SQUARE_MILES;
						configJson.defaultLengthUnit = esriUnits.MILES;
						this._pcDef.resolve(configJson);
					}));
				}

				return this._pcDef.promise;
			},

			_hideToolsByConfig: function() {
				if(false === this.config.showArea) {
					this.measurement.hideTool("area");
				}
				if(false === this.config.showDistance) {
					this.measurement.hideTool("distance");
				}
				if(false === this.config.showLocation) {
					this.measurement.hideTool("location");
				}
			},

			disableWebMapPopup: function() {
				this.map.setInfoWindowOnClick(false);
			},

			enableWebMapPopup: function() {
				this.map.setInfoWindowOnClick(true);
			},

			onDeActive: function() {
				this.onClose();
			},

			onClose: function() {
				this.map.graphics.clear();
				if(this.measurement && this.measurement.activeTool) {
					this.measurement.clearResult();
					this.measurement.setTool(this.measurement.activeTool, false);
				}
			},

			destroy: function() {
				if(this.measurement) {
					this.measurement.destroy();
				}
				this.inherited(arguments);
			}
		});
		return clazz;
	});

require(["esri/layers/LabelLayer"], function(ll) {
	if(typeof esri.layers.LabelLayer.prototype._addLabel == 'function') {
		esri.layers.LabelLayer.prototype._addLabel2 = esri.layers.LabelLayer.prototype._addLabel;
		esri.layers.LabelLayer.prototype._addLabel = function(a, b, c, e, g, k, m) {
			// replace \n by <br>
			a = a.replace(/\n/g, "<br />");
			this._addLabel2(a, b, c, e, g, k, m);
		}
	}
});

require(["esri/symbols/TextSymbol", "dojox/gfx/svg"], function(ts, svg) {
	if(typeof dojox.gfx.svg.Text.prototype.setShape == 'function') {
		dojox.gfx.svg.Text.prototype.setShape = function(p) {
			this.shape = dojox.gfx.makeParameters(this.shape, p);
			this.bbox = null;
			var r = this.rawNode,
				s = this.shape;
			r.setAttribute("x", s.x);
			r.setAttribute("y", s.y);
			r.setAttribute("text-anchor", s.align);
			r.setAttribute("text-decoration", s.decoration);
			r.setAttribute("rotate", s.rotated ? 90 : 0);
			r.setAttribute("kerning", s.kerning ? "auto" : 0);
			r.setAttribute("text-rendering", "optimizeLegibility");

			while(r.firstChild)
				r.removeChild(r.firstChild);

			if(s.text) {
				var texts = s.text.replace(/<br\s*\/?>/ig, "\n").split("\n");
				var lineHeight = 1.1 * parseInt(document.defaultView.getComputedStyle(r, "").getPropertyValue("font-size"), 10);
				if(isNaN(lineHeight) || !isFinite(lineHeight))
					lineHeight = 15;

				for(var i = 0, n = texts.length; i < n; i++) {
					var tspan = (document.createElementNS ? document.createElementNS(dojox.gfx.svg.xmlns.svg, "tspan") : document.createElement("tspan"));
					tspan.setAttribute("dy", i ? lineHeight : -(texts.length - 1) * lineHeight / 2);
					tspan.setAttribute("x", s.x);
					tspan.appendChild((dojox.gfx.useSvgWeb ? document.createTextNode(texts[i], true) : document.createTextNode(texts[i])));
					r.appendChild(tspan);
				}
			}

			return this;
		}
	}
});