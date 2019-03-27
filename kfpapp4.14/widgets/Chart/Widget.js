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
    'dojo/_base/query',
    'dojo/_base/html',
    'dojo/_base/array',
    'dojo/_base/fx',
    'dojo/on',
    'dijit/_WidgetsInTemplateMixin',
    'jimu/BaseWidget',
    'jimu/dijit/Message',
    'jimu/dijit/DrawBox',
    'jimu/utils',
    'jimu/filterUtils',
    'esri/layers/GraphicsLayer',
    'esri/renderers/SimpleRenderer',
    'esri/symbols/jsonUtils',
    'esri/request',
    'esri/graphicsUtils',
    "esri/dijit/FeatureTable",
    './Preview',
    './Query',
    'jimu/LayerInfos/LayerInfos',
    'jimu/dijit/Popup',
    'jimu/dijit/LoadingShelter'
  ],
  function(declare, lang, query, html, array, fx, on, _WidgetsInTemplateMixin,
    BaseWidget, Message, DrawBox, jimuUtils, FilterUtils, GraphicsLayer, SimpleRenderer,
    symbolJsonUtils, esriRequest, graphicsUtils,FeatureTable, Preview, Query, LayerInfos, Popup) {
      var bottomDiv = document.getElementById("tableDiv2");

    return declare([BaseWidget, _WidgetsInTemplateMixin], {
      name: 'Chart',
      baseClass: 'jimu-widget-chart',
      isValidConfig:false,
      currentAttrs: null,
      tempResultLayer: null,
      previewArgs: null,
      previewPopup: null,
      layerInfosObj: null,

      //test:
      //http://sampleserver6.arcgisonline.com/arcgis/rest/services/USA/MapServer
      //http://map.floridadisaster.org/GIS/rest/services/Events/FL511_Feeds/MapServer/4
      //http://maps.usu.edu/ArcGIS/rest/services/MudLake/MudLakeMonitoringSites/MapServer/0
      //http://sampleserver6.arcgisonline.com/arcgis/rest/services/SampleWorldCities/MapServer/1

      _resetCurrentAttrs: function(){
        this.currentAttrs = {
          chartTr: null,
          config: null,
          layerInfo: null
        };
      },

      postMixInProperties: function() {
        this.inherited(arguments);
        this.nls.horizontalAxis = this.nls.horizontalAxis || "Horizontal Axis";
        this.nls.verticalAxis = this.nls.verticalAxis || "Vertical Axis";
        this.nls.dataLabels = this.nls.dataLabels || "Data Labels";
        this.nls.color = this.nls.color || "Color";
        this.nls.colorful = this.nls.colorful || "Colorful";
        this.nls.monochromatic = this.nls.monochromatic || "Monochromatic";
        this.nls.clearResults = window.jimuNls.drawBox.clear;
        this.layerInfosObj = LayerInfos.getInstanceSync();
        if(this.config){
          this._updateConfig();
        }
      },

      _updateConfig: function() {
        if (this.config && this.config.charts && this.config.charts.length > 0) {
          array.forEach(this.config.charts, lang.hitch(this, function(singleConfig) {
            this._rebuildFilter(singleConfig.url, singleConfig.filter);
          }));
        }
      },

      _rebuildFilter: function(url, filter) {
        try {
          if (filter) {
            delete filter.expr;
            var filterUtils = new FilterUtils();
            filterUtils.isHosted = jimuUtils.isHostedService(url);
            filterUtils.getExprByFilterObj(filter);
          }
        } catch (e) {
          console.log(e);
        }
      },

      postCreate: function(){
        this.inherited(arguments);
        jimuUtils.combineRadioCheckBoxWithLabel(this.cbxUseSpatial, this.labelUseSpatial);
        jimuUtils.combineRadioCheckBoxWithLabel(this.cbxUseMapExtent, this.labelUseMapExtent);
        jimuUtils.combineRadioCheckBoxWithLabel(this.cbxDrawGraphic, this.labelDrawGraphic);
        this._initDrawBox();
        this._initPreview();
        this._resetAndAddTempResultLayer();
        this._initSelf();


      },

      onOpen: function(){
        if(this.tempResultLayer){
          this.tempResultLayer.show();
        }
      },

      // onActive: function(){
      //   this.map.setInfoWindowOnClick(false);
      // },

      onDeActive: function(){
        //deactivate method of DrawBox dijit will call this.map.setInfoWindowOnClick(true) inside
        this.drawBox.deactivate();
      },

      onClose: function(){
        if(this.tempResultLayer){
          this.tempResultLayer.hide();
        }
        this._hideInfoWindow();
        this.drawBox.clear();
        this.preview.onClose();
        this.inherited(arguments);
      },

      resize: function(){
        setTimeout(lang.hitch(this, function(){
          this._updatePreviewHeight();
          this.preview.resize();
        }), 100);
      },

      destroy: function(){
        this._clickClearButton(true);
        this.inherited(arguments);
      },

      _isConfigValid:function(){
        return this.config && typeof this.config === 'object';
      },

      _initDrawBox: function(){
        this.drawBox = new DrawBox({
          types: ['point', 'polyline', 'polygon'],
          map: this.map,
          showClear: true,
          keepOneGraphic: true
        });
        this.drawBox.placeAt(this.drawBoxDiv);
        this.drawBox.startup();
      },

      _createBigPreview: function(){
        if(!this.previewArgs){
          return;
        }
        //60 75
        var windowWidth = document.body.clientWidth;
        var windowHeight = document.body.clientHeight;
        var margin = 20;
        var width = windowWidth - 2 * margin;
        var height = windowHeight - 2 * margin;
        if(width < 100 || height < 100){
          return;
        }
        var bigPreview = new Preview({
          nls: this.nls,
          map: this.map,
          folderUrl: this.folderUrl,
          fontColor: this.appConfig.theme.name === "DartTheme" ? "#ffffff" : "#333333",
          tooltipColor: this.appConfig.theme.name === "LaunchpadTheme" ? "#ffffff" : "green",
          style: "width:100%;height:100%;",
          isBigPreview: true
        });
        this.previewPopup = new Popup({
          width: width,
          height: height,
          titleLabel: this.nls._widgetLabel,
          content: bigPreview,
          onClose: lang.hitch(this, function(){
            bigPreview.destroy();
            bigPreview = null;
            this.previewPopup = null;
          })
        });
        setTimeout(lang.hitch(this, function(){
          bigPreview.createCharts(this.previewArgs);
        }), 100);
      },

      _initPreview: function(){
        this.preview = new Preview({
          nls: this.nls,
          map: this.map,
          appConfig:this.appConfig,
          folderUrl: this.folderUrl,
          fontColor: this.appConfig.theme.name === "DartTheme" ? "#ffffff" : "#333333",
          tooltipColor: this.appConfig.theme.name === "LaunchpadTheme" ? "#ffffff" : "green",
          showZoomIcon: true
        });
        this.preview.placeAt(this.resultsContainer);
        this.preview.startup();
        this.own(on(this.preview, 'zoomin', lang.hitch(this, this._createBigPreview)));
      },

      _initSelf: function(){
        var uniqueId = jimuUtils.getRandomString();
        var cbxName = "Chart_" + uniqueId;
        this.cbxUseMapExtent.name = cbxName;
        this.cbxDrawGraphic.name = cbxName;

        this.isValidConfig = this._isConfigValid();
        if(!this.isValidConfig){
          html.setStyle(this.chartsNode, 'display', 'none');
          html.setStyle(this.invalidConfigNode, {
            display: 'block',
            left: 0
          });
          return;
        }

        var charts = this.config.charts;

        if(charts.length === 0){
          html.setStyle(this.chartsNode, 'display', 'none');
          html.setStyle(this.noChartTipSection, 'display', 'block');
          return;
        }

        array.forEach(charts, lang.hitch(this, function(singleConfig, index){
          var name = singleConfig.name;
          var strTr = '<tr class="single-chart jimu-table-row">' +
          '<td class="first-td"></td>' +
          '<td class="second-td">' +
            '<div class="chart-name-div"></div>' +
          '</td>' +
          '<td class="third-td">' +
            '<div class="arrow"></div>' +
          '</td>' +
          '</tr>';
          var tr = html.toDom(strTr);
          var chartNameDiv = query(".chart-name-div", tr)[0];
          chartNameDiv.innerHTML = jimuUtils.stripHTML(name);
          html.place(tr, this.chartsTbody);
          tr.singleConfig = singleConfig;
          if (index % 2 === 0) {
            html.addClass(tr, 'even');
          } else {
            html.addClass(tr, 'odd');
          }
        }));
      },

      _resetAndAddTempResultLayer: function(){
        this._removeTempResultLayer();
        this.tempResultLayer = new GraphicsLayer();
        this.map.addLayer(this.tempResultLayer);
      },

      _removeTempResultLayer: function(){
        if(this.tempResultLayer){
          this.map.removeLayer(this.tempResultLayer);
        }
        this.tempResultLayer = null;
      },

      _clickClearButton: function(/*optional*/ dontSlide){
        this._hideInfoWindow();
        this.drawBox.clear();
        this._removeTempResultLayer();
        this._clearResultPage();
        //the default value of dontSlide is false.
        //if true, it means the widgte will destroy and it needn't slide.
        if(!dontSlide){
          this._fromCurrentPageToChartList();
        }
      },

      _slide: function(dom, startLeft, endLeft){
        html.setStyle(dom, 'display', 'block');
        html.setStyle(dom, 'left', startLeft + "%");
        fx.animateProperty({
          node: dom,
          properties:{
            left:{
              start: startLeft,
              end: endLeft,
              units: '%'
            }
          },
          duration: 500,
          onEnd: lang.hitch(this, function(){
            html.setStyle(dom, 'left', endLeft);
            if(endLeft === 0){
              html.setStyle(dom, 'display', 'block');
            }
            else{
              html.setStyle(dom, 'display', 'none');
            }
          })
        }).play();
      },

      _onChartListClicked: function(event){
        var target = event.target || event.srcElement;
        var tr = jimuUtils.getAncestorDom(target, lang.hitch(this, function(dom){
          return html.hasClass(dom, 'single-chart');
        }), 10);
        if(!tr){
          return;
        }

        var singleConfig = tr.singleConfig;
        this._resetCurrentAttrs();
        this.currentAttrs.chartTr = tr;
        this.currentAttrs.config = lang.clone(singleConfig);
        this.currentAttrs.layerInfo = this.currentAttrs.chartTr.layerInfo;//may be null

        query('tr.single-chart', this.chartsTbody).removeClass('jimu-state-active');
        html.addClass(this.currentAttrs.chartTr, 'jimu-state-active');

        var callback = lang.hitch(this, function() {
          this.currentAttrs.layerInfo = this.currentAttrs.chartTr.layerInfo;
          this._fromChartListToChartParams();
        });

        if(this.currentAttrs.chartTr.layerInfo){
          callback();
        }
        else{
          var layerUrl = this.currentAttrs.config.url;
          this.shelter.show();
          esriRequest({
            url: layerUrl,
            content: {
              f: 'json'
            },
            handleAs: 'json',
            callbackParamName: 'callback'
          }).then(lang.hitch(this, function(response){
            if (!this.domNode) {
              return;
            }
            this.shelter.hide();
            this.currentAttrs.chartTr.layerInfo = response;
            this.currentAttrs.layerInfo = this.currentAttrs.chartTr.layerInfo;
            callback();
          }), lang.hitch(this, function(err){
            console.error(err);
            if (!this.domNode) {
              return;
            }
            this.shelter.hide();
            var errMsg = "";
            if(err && err.httpCode === 403){
              errMsg = this.nls.noPermissionsMsg;
            }
            this._showQueryErrorMsg(errMsg);
          }));
        }
      },

      _fromCurrentPageToChartList: function(){
        html.setStyle(this.chartList, 'display', 'block');

        if(html.getStyle(this.chartParams, 'display') === 'block'){
          this._slide(this.chartList, -100, 0);
          this._slide(this.chartParams, 0, 100);
        }
        else if(html.getStyle(this.chartResults, 'display') === 'block'){
          this._slide(this.chartList, -100, 0);
          this._slide(this.chartResults, 0, 100);
        }
      },

      _onCbxUseSpatialClicked: function(){
        if(this.cbxUseSpatial.checked){
          html.setStyle(this.selectSpatialDiv, 'display', 'block');
        }
        else{
          html.setStyle(this.selectSpatialDiv, 'display', 'none');
        }

        if (this.cbxUseMapExtent.checked) {
          this._onCbxUseMapExtentClicked();
        } else {
          this._onCbxDrawGraphicClicked();
        }

        this._resetDrawBox();
      },

      _onCbxUseMapExtentClicked: function(){
        if(this.cbxUseMapExtent.checked){
          this._resetDrawBox();
          html.setStyle(this.drawBoxDiv, 'display', 'none');
        }
      },

      _onCbxDrawGraphicClicked: function(){
        if(this.cbxDrawGraphic.checked){
          html.setStyle(this.drawBoxDiv, 'display', 'block');
        }
      },

      _onBtnClearAllClicked: function(){
        if(this.chartsTbody.childElementCount === 0){
          return;
        }

        var isChartListVisible = this.chartList.style.display !== 'none';
        var dontSlide = isChartListVisible;
        this._clickClearButton(dontSlide);
      },

      _resetDrawBox: function(){
        this.drawBox.deactivate();
        this.drawBox.clear();
      },

      _resetChartParamsPage: function(){
        this.cbxUseSpatial.checked = false;
        this._onCbxUseSpatialClicked();
        this._resetDrawBox();
      },

      _fromChartListToChartParams: function(){
        //reset UI of params page
        this._resetChartParamsPage();
        //var layerUrl = this.currentAttrs.config.url;

        //slide
        var showDom = this.chartParams;
        var hideDom = this.chartResults;

        html.setStyle(this.chartList, {
          left: 0,
          display: 'block'
        });

        html.setStyle(showDom, {
          left: '100%',
          display: 'block'
        });

        html.setStyle(hideDom, 'display', 'none');
        this._slide(this.chartList, 0, -100);
        this._slide(showDom, 100, 0);
        this._onBtnApplyClicked();
      },

      _onBtnParamsBackClicked: function(){
        this._resetDrawBox();
        html.setStyle(this.chartList, 'display', 'block');
        html.setStyle(this.chartParams, 'display', 'block');
        html.setStyle(this.chartResults, 'display', 'none');
        this._slide(this.chartList, -100, 0);
        this._slide(this.chartParams, 0, 100);
      },

      //start to query
      _onBtnApplyClicked: function(){
        //reset result page
        this._clearResultPage();
        //var layerInfo = this.currentAttrs.layerInfo;

        var where = this.currentAttrs.config.filter.expr;
        var geometry = null;

        if(this.cbxUseSpatial.checked){
          if(this.cbxUseMapExtent.checked){
            geometry = this.map.extent;
          }
          else{
            var gs = this.drawBox.drawLayer.graphics;
            if(gs.length > 0){
              var g = gs[0];
              geometry = g.geometry;
            }
          }
          if(!geometry){
            new Message({message: this.nls.specifySpatialFilterMsg});
            return;
          }
        }

        if(this.tempResultLayer){
          this.map.removeLayer(this.tempResultLayer);
        }
        this.tempResultLayer = null;

        //set query.resultLayer
        this._createChartResultLayer();

        this._resetDrawBox();

        html.setStyle(this.chartList, 'display', 'none');
        html.setStyle(this.chartParams, 'display', 'block');
        html.setStyle(this.chartResults, 'display', 'block');
        this._slide(this.chartParams, 0, -100);
        this._slide(this.chartResults, 100, 0);

        var singleConfig = this.currentAttrs.config;
        var outFields = [];
        var mode = singleConfig.mode;
        if(mode === 'feature'){
          outFields = lang.clone(singleConfig.valueFields);
          if(outFields.indexOf(singleConfig.labelField) < 0){
            outFields.push(singleConfig.labelField);
          }
        }
        else if(mode === 'category'){
          outFields = lang.clone(singleConfig.valueFields);
          if(outFields.indexOf(singleConfig.categoryField) < 0){
            outFields.push(singleConfig.categoryField);
          }
        }
        else if(mode === 'count'){
          outFields = [singleConfig.categoryField];
        }
        else if(mode === 'field'){
          outFields = lang.clone(singleConfig.valueFields);
        }

        this.shelter.show();
        var baseExpr = this._getBaseExpression(this.currentAttrs.config.webMapLayerId);
        if(baseExpr){
          where = "(" + baseExpr + ") AND " + "(" + where + ")";
        }
        this._query(where, outFields, geometry).then(lang.hitch(this, function(response){
          //response: {status,count,features}
          if(!this.domNode){
            return;
          }
          this.shelter.hide();
          if(response.status > 0){
            var args = {
              config: singleConfig,
              features: response.features,
              layerDefinition: this.currentAttrs.layerInfo,
              resultLayer: this.tempResultLayer
            };

            this.previewArgs = args;

            //update preview height
            this._updatePreviewHeight();

            //preview will filter features
            this.preview.createCharts(args);

            //add the filtered features to layer
            array.forEach(response.features, lang.hitch(this, function(feature){
              this.tempResultLayer.add(feature);
            }));

            this._zoomToLayer(this.tempResultLayer);
          }
        }), lang.hitch(this, function(err){
          console.error(err);
          if(!this.domNode){
            return;
          }
          this.shelter.hide();
          this._removeTempResultLayer();
        }));
      },

      _getBaseExpression: function(webMapLayerId){
        var baseExpr = "";
        //var webMapLayerId = this.currentAttrs.config.webMapLayerId;
        if(webMapLayerId){
          var info = null;
          if(this.currentAttrs.layerInfo.type === 'Table'){
            info = this.layerInfosObj.getTableInfoById(webMapLayerId);
          }else{
            info = this.layerInfosObj.getLayerInfoById(webMapLayerId);
          }
          if(info){
            baseExpr = info.getFilter();
          }
        }
        return baseExpr;
      },

      _updatePreviewHeight: function() {
        var box = html.getContentBox(this.domNode);
        var h = Math.max(box.h - 120, 150);

        //update preview height
        html.setStyle(this.preview.domNode, 'height', h + 'px');
      },

      _createChartResultLayer: function(){
        //use graphics layer
        this._resetAndAddTempResultLayer();

        var symbol = symbolJsonUtils.fromJson(this.currentAttrs.config.symbol);
        var renderer = new SimpleRenderer(symbol);

        //set renderer
        this.tempResultLayer.setRenderer(renderer);
      },

      //resovle {status,count,features}
      _query: function(where, outFields, /*optional*/ geometry){
        if(!where){
          where = "1=1";
        }

        var options = {};
        options.url = this.currentAttrs.config.url;
        options.layerInfo = this.currentAttrs.layerInfo;
        options.limit = 10 * 1000;
        options.spatialReference = this.map.spatialReference;
        options.where = where;
        options.geometry = geometry;
        options.outFields = outFields;

        var query = new Query(options);
        return query.getFeatures();

        /*var def = new Deferred();
        var queryParams = new EsriQuery();

        queryParams.where = where;
        if(geometry){
          queryParams.geometry = geometry;
        }
        queryParams.outSpatialReference = this.map.spatialReference;
        queryParams.returnGeometry = true;
        queryParams.outFields = outFields;
        var url = this.currentAttrs.config.url;
        var queryTask = new QueryTask(url);
        queryTask.execute(queryParams).then(lang.hitch(this, function(featureSet){
          def.resolve(featureSet);
        }), lang.hitch(this, function(err){
          //maybe a joined layer
          if(err && err.code === 400){
            queryParams.outFields = ["*"];
            var queryTask2 = new QueryTask(url);
            queryTask2.execute(queryParams).then(lang.hitch(this, function(featureSet2){
              def.resolve(featureSet2);
            }), lang.hitch(this, function(err2){
              def.reject(err2);
            }));
          }else{
            def.reject(err);
          }
        }));

        return def;*/
      },

      _clearResultPage: function(){
        if(this.previewPopup){
          this.previewPopup.close();
          this.previewPopup = null;
        }
        this.previewArgs = null;
        this.preview.clear();
        this._hideInfoWindow();
      },

      _zoomToLayer: function(gl){
        try{
          //some graphics maybe don't have geometry, so need to filter graphics here by geometry
          var graphics = array.filter(gl.graphics, function(g){
            return !!g.geometry;
          });
          if(graphics.length > 0){
            var ext = graphicsUtils.graphicsExtent(graphics);
            if(ext){
              ext = ext.expand(1.4);
              this.map.setExtent(ext);
            }
          }
        }
        catch(e){
          console.error(e);
        }
      },

      _showQueryErrorMsg: function(/* optional */ msg){
        new Message({message: msg || this.nls.queryError});
      },

      _hideInfoWindow: function(){
      },

      _onBtnResultsBackClicked: function(){
        var showDom, hideDom;

        showDom = this.chartParams;
        hideDom = this.chartList;

        html.setStyle(hideDom, 'display', 'none');
        html.setStyle(showDom, {
          display: 'block',
          left: '-100%'
        });
        this._slide(showDom, -100, 0);
        this._slide(this.chartResults, 0, 100);
        this._onBtnParamsBackClicked();
      }

    });
  });