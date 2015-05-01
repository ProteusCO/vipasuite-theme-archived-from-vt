(function($, d, w) {
  function DashboardAnalytics(target, opts) {
    var _defaults = {
      api: {
        accessToken: '',
        accountId: '',
        webPropertyId: ''
      },
      selectors: {
        display: '.dashbaord-charts-display',
        forbidden: '.dashboard-charts-forbidden',
        noprofile: '.dashboard-charts-noprofile',
	      noanalytics: '.dashboard-charts-noanalytics'
      },
      profileName: 'VipaSuite Dashboard',
      profileId: '',
      chartConfig: {
        query: {
          'start-date': '30daysAgo',
          'end-date': 'yesterday'
        },
        chart: {
          options: {
            width: '100%'
          }
        }
      },
      charts: {
        'daily-traffic': {
          title: 'Daily Traffic Summary',
          boxType: 'full',
          config: {
            query: {
              metrics: 'ga:sessions',
              dimensions: 'ga:date'
            },
            chart: {
              type: 'LINE',
              options: {
                legend: {
                  alignment: 'center',
                  position: 'top'
                }
              }
            }
          }
        },
        'device-traffic': {
          title: 'Device Traffic',
          boxType: 'half',
          config: {
            query: {
              metrics: 'ga:pageviews',
              dimensions: 'ga:deviceCategory'
            },
            chart: {
              type: 'PIE'
            }
          }
        },
        'geo-distribution': {
          title: 'Geographic Distribution',
          boxType: 'half',
          config: {
            query: {
              metrics: 'ga:sessions',
              dimensions: 'ga:city',
              segment: 'dynamic::ga:country==United States'
            },
            chart: {
              type: 'GEO',
              options: {
                region: 'US',
                resolution: 'provinces',
                displayMode: 'markers'
              }
            }
          }
        },
        'top-pages': {
          title: 'Top pages',
          boxType: 'half',
          config: {
            query: {
              metrics: 'ga:pageviews',
              dimensions: 'ga:pagePath',
              sort: '-ga:pageviews',
              'max-results': 10
            },
            chart: {
              type: 'TABLE'
            }
          }
        },
        'keyword-traffic': {
          title: 'Top Keywords',
          boxType: 'half',
          config: {
            query: {
              metrics: 'ga:sessions',
              dimensions: 'ga:keyword',
              sort: '-ga:sessions',
              filters: 'ga:keyword!~\\(not',
              'max-results': 10
            },
            chart: {
              type: 'TABLE'
            }
          }
        }
      }
    };

    var _settings = {};
    var _$root, _$display;
    var _charts = [];
    var CSS_CLASS_LOADING = 'loading';
    var CSS_CLASS_VISIBLE = 'visible';

    function _handleSetupError(results) {
      var error = results.error;
      if (error.code == 403) {
        _$root.find(_settings.selectors.forbidden).addClass(CSS_CLASS_VISIBLE);
      }
    }
    
    function _handleProfileError() {
        _$root.find(_settings.selectors.noprofile).addClass(CSS_CLASS_VISIBLE);      
    }

	  function _handleAnalyticsError() {
		  _$root.find(_settings.selectors.noanalytics).addClass(CSS_CLASS_VISIBLE);
	  }

    function _setupCharts() {
      var chartSettings = $.extend(true, {}, _settings.chartConfig, {
        query: {
          ids: 'ga:' + _settings.profileId
        }
      });

      _$display.addClass(CSS_CLASS_VISIBLE);

      $.each(_settings.charts, function(key, chart) {
        var conKey = 'da-' + key;
        var chartConKey = conKey + '-chart';

        var $chart = $(['<div class="chart ' + [conKey, CSS_CLASS_LOADING].join(' ') + '"><div class="chart-inner">',
            '<div class="loading-status"><div class="loading-status-icon"></div></div>',
            '<div class="chart-heading">' + chart.title + '</div>',
            '<div id="' + chartConKey + '" />',
            '</div></div>'].join('')).appendTo(_$display);

        var chartConfig = $.extend(true, {}, chart.config, chartSettings, {
          chart: {
            container: chartConKey
          }
        });

        $chart.addClass('chart-box-' + chart.boxType);

        var gaDataChart = new gapi.analytics.googleCharts.DataChart(chartConfig);
        gaDataChart.on('success', function(res) {
          _charts.push({
            chart: res.chart,
            data: res.data,
            dataTable: res.dataTable,
            opts: chartConfig.chart.options
          });
          $chart.removeClass(CSS_CLASS_LOADING);
        });
        gaDataChart.execute();
      });

    }

    function _setupAnalytics(results) {
      _$root.removeClass(CSS_CLASS_LOADING);

      if (!results || results.error) {
        _handleSetupError(results);
        return;
      }

      var profiles = results.items;
      for (var i = 0, profile; profile = profiles[i]; i++) {
        if (profile.name.toLowerCase().trim() == _settings.profileName.toLowerCase().trim()) {
          _settings.profileId = profile.id;
        }
      }

      if (_settings.profileId.length) {
        _setupCharts();
      } else {
        _handleProfileError();
      }
      
    }

    function _initAnalyticsAccess() {
      gapi.analytics.auth.authorize({
        serverAuth: {
          access_token: _settings.api.accessToken
        }
      });
      
      gapi.client.analytics.management.profiles.list({
        'accountId': _settings.api.accountId,
        'webPropertyId': _settings.api.webPropertyId
      }).execute(_setupAnalytics);
    }

    function _init() {
      _settings = $.extend({}, _defaults, opts);
      _$root = $(target);

      if (_$root.data('dashboard-init')) {
        return;
      }

      _$display = _$root.find(_settings.selectors.display);

	    if (!_settings.api.accessToken || !_settings.api.accountId || !_settings.api.webPropertyId) {
		    _$root.removeClass(CSS_CLASS_LOADING);
		    _handleAnalyticsError();
	    } else {
		    w.gapi.analytics.ready(_initAnalyticsAccess);
	    }

      _$root.data('dashboard-init', true);
    }

	  _init();
  }
  
  w.__DashboardAnalytics = DashboardAnalytics;
})(jQuery, document, window);