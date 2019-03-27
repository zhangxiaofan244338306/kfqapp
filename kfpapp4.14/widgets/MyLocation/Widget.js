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
		'jimu/BaseWidget',
		"esri/dijit/LocateButton",
		'dojo/_base/html',
		'dojo/on',
		'dojo/_base/lang',
		"esri/tasks/GeometryService",
		"esri/SpatialReference",
		"esri/geometry/Point",
		"esri/graphic",
		 "esri/symbols/SimpleMarkerSymbol",
		 "esri/symbols/PictureMarkerSymbol",
		'jimu/utils',
		'jimu/dijit/Message',
		'dojo/touch'
	],
	function(declare, BaseWidget, LocateButton, html, on, lang, GeometryService, SpatialReference, Point, graphic, SimpleMarkerSymbol,PictureMarkerSymbol,jimuUtils) {
		var clazz = declare([BaseWidget], {

			name: 'MyLocation',
			baseClass: 'jimu-widget-mylocation',

			startup: function() {
				this.inherited(arguments);
				this.placehoder = html.create('div', {
					'class': 'place-holder',
					title: this.label
				}, this.domNode);

				this.own(on(this.placehoder, 'click', lang.hitch(this, this.onLocationClick)));
				this.own(on(this.map, 'zoom-end', lang.hitch(this, this._scaleChangeHandler)));
			},

			onLocationClick: function() {
				var self = this;
				self.map.graphics.clear();
				plus.geolocation.getCurrentPosition(function(p) {
					this.latitude = p.coords.latitude;
					this.longitude = p.coords.longitude;
					//创建几何服务对象
					var geometryServices = new GeometryService("http://112.4.212.98:6080/arcgis/rest/services/Utilities/Geometry/GeometryServer");
					var point = new Point(this.longitude ,this.latitude, new SpatialReference({
						wkid: 4326
					}));
					this.outSR = new esri.SpatialReference({
						wkid: 2364
					});
					geometryServices.project([point], this.outSR, function(geometry) {
						var a = geometry;
						var markSymbol = new PictureMarkerSymbol("widgets/MyLocation/images/location.png",10,10).setOffset(0,0);

						var point1 = new Point(geometry[0].x, geometry[0].y, new SpatialReference({'wkt':'PROJCS["Xian_1980_3_Degree_GK_Zone_40",GEOGCS["GCS_Xian_1980",DATUM["D_Xian_1980",SPHEROID["Xian_1980",6378140.0,298.257]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Gauss_Kruger"],PARAMETER["False_Easting",40500000.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",120.0],PARAMETER["Scale_Factor",1.0],PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]'}));
						var gr = new graphic(point1, markSymbol);
						
						self.map.graphics.add(gr);
						self.map.centerAndZoom(point1,3);

					});
				}, function(e) {
					alert("Geolocation error: " + e.message);
				});
			},
			//use current scale in Tracking
			_scaleChangeHandler: function() {
				var scale = this.map.getScale();
				if(scale && this.geoLocate && this.geoLocate.useTracking) {
					this.geoLocate.scale = scale;
				}
			},

			onLocate: function(parameters) {
				html.removeClass(this.placehoder, "locating");
				if(this.geoLocate.useTracking) {
					html.addClass(this.placehoder, "tracking");
				}

				if(parameters.error) {
					console.error(parameters.error);
					// new Message({
					//   message: this.nls.failureFinding
					// });
				} else {
					html.addClass(this.domNode, "onCenter");
					this.neverLocate = false;
				}
			},

			_createGeoLocate: function() {
				var json = this.config.locateButton;
				json.map = this.map;
				if(typeof(this.config.locateButton.useTracking) === "undefined") {
					json.useTracking = true;
				}
				json.centerAt = true;
				json.setScale = true;

				var geoOptions = {
					maximumAge: 0,
					timeout: 15000,
					enableHighAccuracy: true
				};
				if(json.geolocationOptions) {
					json.geolocationOptions = lang.mixin(geoOptions, json.geolocationOptions);
				}

				this.geoLocate = new LocateButton(json);
				this.geoLocate.startup();

				this.geoLocate.own(on(this.geoLocate, "locate", lang.hitch(this, this.onLocate)));
			},

			_destroyGeoLocate: function() {
				if(this.geoLocate) {
					this.geoLocate.clear();
					this.geoLocate.destroy();
				}

				this.geoLocate = null;
			},

			destroy: function() {
				this._destroyGeoLocate();
				this.inherited(arguments);
			}
		});
		clazz.inPanel = false;
		clazz.hasUIFile = false;
		return clazz;
	});