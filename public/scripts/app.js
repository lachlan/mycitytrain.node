/* Hacky crappy built-in prototype extentions */
// Pluralizes a string by adding an 's' on the end
String.prototype.pluralize = function(count) {
  if (count == undefined) count = 0;
  return count + " " + ((count == 1 || count == '1')? this : this + 's');
};
/* To Title Case 1.1.1
 * David Gouch <http://individed.com>
 * 23 May 2008
 * License: http://individed.com/code/to-title-case/license.txt
 *
 * In response to John Gruber's call for a Javascript version of his script: 
 * http://daringfireball.net/2008/05/title_case
 */
String.prototype.toTitleCase = function() {
  return this.replace(/([\w&`'‘’"“.@:\/\{\(\[<>_]+-? *)/g, function(match, p1, index, title) {
    if (index > 0 && title.charAt(index - 2) !== ":" && match.search(/^(a(nd?|s|t)?|b(ut|y)|en|for|i[fn]|o[fnr]|t(he|o)|vs?\.?|via)[ \-]/i) > -1)
      return match.toLowerCase();
    if (title.substring(index - 1, index + 1).search(/['"_{(\[]/) > -1)
      return match.charAt(0) + match.charAt(1).toUpperCase() + match.substr(2);
    if (match.substr(1).search(/[A-Z]+|&|[\w]+[._][\w]+/) > -1 || title.substring(index - 1, index + 1).search(/[\])}]/) > -1)
      return match;
    return match.charAt(0).toUpperCase() + match.substr(1);
  });
};
String.prototype.escape = function() {
  return escape(this.replace(/\s/g, '-'));
}
String.prototype.unescape = function() {
  return unescape(this).replace(/[-_]/g, ' ');
}
Date.prototype.duration = function(other, unit) {
  var duration = other.getTime() - this.getTime();
  if (unit == 'seconds') {
    duration = Math.round(duration/1000); 
  } else if (unit == 'minutes') {
    duration = Math.round(duration/(60000));
  } else if (unit == 'words') {
    duration = Math.round(duration/1000);
    if (duration <= 0) {
      duration = "now";
    } else if (duration >= 1 && duration <= 3599) {
      duration = "min".pluralize(Math.ceil(duration/60));
    } else if (duration >= 3600 && duration <= 86399) {
      var durationInHours = Math.floor(duration/3600);
      var remainderInMinutes = (duration % 3600)/60;
      if (remainderInMinutes < 30) {
        duration = "hour".pluralize(durationInHours);
      } else {
        duration = "hour".pluralize(durationInHours + 0.5);
      }
    } else if (duration >= 86400 && duration <= 2591999) {
      var durationInDays = Math.floor(duration/86400);
      var remainderInHours = (duration % 86400)/3600;
      if (remainderInHours < 12) {
        duration = "day".pluralize(durationInDays);
      } else {
        duration = "day".pluralize(durationInDays + 0.5);
      }
    } else if (duration <= 2592000 && duration <= 31535999) {
      duration = "mth".pluralize(Math.ceil(duration/2592000));
    } else {
      duration = "yr".pluralize(Math.ceil(duration/31536000));
    }
  }
  return duration;
};
// Returns a Date for the next second, minute or hour
Date.prototype.next = function(unit) {
  var n = new Date(this.getTime());
  if (unit == 'millisecond' || unit == undefined) {
    n.setMilliseconds(this.getMilliseconds() + 1);
  } else if (unit == 'second') {
    n.setSeconds(this.getSeconds() + 1);
    n.setMilliseconds(0);
  } else if (unit == 'minute') {
    n.setMinutes(this.getMinutes() + 1);
    n.setSeconds(0);
    n.setMilliseconds(0);
  } else if (unit == 'hour') {
    n.setHours(this.getHours() + 1);
    n.setMinutes(0);
    n.setSeconds(0);
    n.setMilliseconds(0);
  }
  return n;
}
Date.prototype.format = function() {
  var hours = this.getHours() <= 12 ? this.getHours() : this.getHours() - 12
  if (this.getHours() === 0) hours = 12
  var minutes = this.getMinutes() < 10 ? '0' + this.getMinutes() : this.getMinutes()
  var meridiem = this.getHours() < 12 ? 'am' : 'pm'
  return hours + ':' + minutes + ' ' + meridiem
}
Date.__original_parse__ = Date.parse;
Date.parse = function(other) {
  var date = new Date()
  if (_(other).isNumber()) {
    date.setTime(other)
  } else if (_(other).isDate()) {
    date = other
  } else if (_(other).isString()){
    var matches = other.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}).(\d{3})(Z)/)  // ISO8601 datetime string
    if (matches) {
      var year = parseInt(matches[1], 10)
        , month = parseInt(matches[2], 10)
        , day = parseInt(matches[3], 10)
        , hours = parseInt(matches[4], 10)
        , minutes = parseInt(matches[5], 10)
        , seconds = parseInt(matches[6], 10)
        , milliseconds = parseInt(matches[7], 10)
        
      date = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, milliseconds))
    } else {
      date = Date.__original_parse__(other);
    }
  } else {
    date = Date.__original_parse__(other);
  }
  return date
}
Date.now = function() { return new Date(); }

/** Main application object, container for models, views and controllers */
var App = {
  Models: {},
  Views: {},
  Routers: {}
};

$(function() {
  $.support.WebKitAnimationEvent = (typeof WebKitTransitionEvent == "object");
  var active = 'active';
  // handle transitions automatically on non-disabled and non-submit links
  $('body').delegate('a.fx:not(.disabled):not(.submit)', 'click', function() { 
    $(this).parents('.page').attr('data-fx', $(this).attr('class'));
  });

  var transition = function(to, callback) {
    var effects = 'fx in out flip slide pop cube swap slideup dissolve fade reverse';
    var from = $('.page:visible');
    to = $(to);

    var effect = from.attr('data-fx');
    if (_.isEmpty(effect)) effect = 'fx slideup reverse'; //default effect
    from.removeAttr('data-fx');

    $(':focus').blur();

    $(from).add(to).removeClass(effects).addClass(effect);

    var finished = function() {
      from.removeClass(active).add(to).removeClass(effects);
      if (_.isFunction(callback)) callback(to);
    }

    to.one('webkitAnimationEnd', finished);
    to.addClass(active).addClass('in');
    from.addClass('out');

    if (!$.support.WebKitAnimationEvent) {
      finished();
    }
  }

  var flash = function(element, options, callback) {
    element = $(element);
    var timeout = 750;

    var blink = function(element, duration, callback) {
      element.animate({ opacity: 0.5 }, duration, 'linear', function() {
        element.animate({ opacity: 1 }, duration, 'linear', function() {
          if (!_.isUndefined(callback) && _.isFunction(callback)) callback();
        });
      });
    }

    blink(element, timeout, function() {
      blink(element, timeout, function() {
        blink(element, timeout, function() {
          element.slideUp('slow', function() {
            element.remove();
          });
        });
      });
    });
  };
  
  /** All the application models: location, locations, journey, journeys, favourite, favourites */
  App.Models.Location = Backbone.Model.extend();
  
  App.Models.Locations = Backbone.Collection.extend({
    model: App.Models.Location,
    url: '/data/locations.json',
    
    parse: function(response) {
      var self = this;
      return _(response).map(function(item) {
        return { name: item };
      });
    },   
    
    search: function(term, exact) {
      var pattern = new RegExp('^' + term, 'i'),
          matches = new Array();
      if (exact) pattern = new RegExp('^' + term + '$', 'i');

      this.each(function(location) {
        if (location.get('name').match(pattern)) matches.push(location.get('name'));
      });
      return matches;
    }
  });
  
  App.Models.Journey = Backbone.Model.extend({
    initialize: function() {
      this.set({ 
        departure: Date.parse(this.get('departure')),
        arrival: Date.parse(this.get('arrival')),
        origin: this.get('origin').unescape().toTitleCase(),
        destination: this.get('destination').unescape().toTitleCase()
      });
      this.unset('eta');
    },
    
    eta: function(unit) {
      if (_(unit).isUndefined()) unit = 'words';
      return Date.now().duration(this.get('departure'), unit);
    },
    
    className: function() {
      var name = '',
          eta = this.eta('minutes');

      if (eta <= '5')
        name = 'now';
      else if (eta <= '10')
        name = 'soon';
  
      return name;
    },
    
    toJSON: function() {
      return _(Backbone.Model.prototype.toJSON.call(this)).extend({
        eta: this.eta(),
        className: this.className()
      });
    }
  });

  App.Models.Journeys = Backbone.Collection.extend({ 
    model: App.Models.Journey,
    limit: 4,
  
    initialize: function(models, options) {
      _(this).bindAll();
      _(this).extend({ 
        origin: options.origin,
        destination: options.destination,
        inverse: options.inverse
      });
    
      if (_.isUndefined(this.inverse)) {
        _(this).extend({
          inverse: new App.Models.Journeys([], { 
            origin: this.destination,
            destination: this.origin,
            inverse: this
          })
        });
      }
    },
    
    url: function(limit) {
      if (_(limit).isUndefined()) limit = this.limit;
      return ('/data/' + this.origin.escape() + '/' + this.destination.escape() + '.json?limit=' + limit).toLowerCase();
    },
    
    parse: function(response) {
      var self = this;
      return _(response).map(function(row) {
        return { 
          origin: self.origin,
          destination: self.destination,
          departure: row[0],
          arrival: row[1]
        }
      });
    },
    
    next: function(callback, limit) {
      var self = this,
          journeys = new App.Models.Journeys([], { 
            origin: self.origin,
            destination: self.destination 
          });

      journeys.url = self.url(limit);  
      if (self.length > 0) journeys.url += '&after=' + JSON.stringify(self.last().get('departure')).escape();
  
      journeys.fetch({ success: function() {
        self.add(journeys.toJSON());
        if (_(callback).isFunction()) callback();
      }});
    },
    
    remove: function(models, options) {
      Backbone.Collection.prototype.remove.call(this, models, options);
    },
    
    expire: function(callback) {
      var self = this;
      if (this.length === 0) {
        this.next(callback);
      } else {
        self.each(function(journey) {
          // trigger an update to the eta
          journey.change();
          // remove it if its departed or about to depart in less than a minute
          if (journey.get('departure') <= (new Date(Date.now().getTime() + 59 * 1000))) self.remove(journey);
        });
        // after removing some services, automatically refresh the collection if its below its limit
        if (this.length < this.limit) 
          this.next(callback, this.limit - this.length);
        else if (_(callback).isFunction())
          callback();
      }
    },
    
    comparator: function(service) {
      return service.get('departure');
    }
  })

  App.Models.Favourite = Backbone.Model.extend({
    initialize: function(attributes) {
      var self = this;
      self.journeys = new App.Models.Journeys([], { origin: self.get('origin'), destination: self.get('destination') });
      
      if (attributes.inverse) {
        self.unset('inverse');
        self.inverse = attributes.inverse;
      } else {
        self.inverse = new App.Models.Favourite({
          origin: self.get('destination'),
          destination: self.get('origin'),
          inverse: self
        });
      }
    },
    
    url: function(hash) {
      if (_(hash).isUndefined()) hash = true;;
      var prefix = hash ? '/#' : '';
      return prefix + '/' + (this.get('origin') + '/' + this.get('destination')).escape().toLowerCase();
    },
    
    expire: function() {
      this.journeys.expire();
      this.inverse.journeys.expire();
    }
  });

  App.Models.Favourites = Backbone.Collection.extend({ 
    model: App.Models.Favourite,
    _cookie: 'favourites',
  
    inverse: function() {
      return new App.Models.Favourites(this.map(function(item) {
        return item.inverse;
      }));
    },
    
    save: function() {
      $.cookie(this._cookie, JSON.stringify(this), { expires: 7 * 52 * 25 });
    },
    
    fetch: function() {
      var json = $.cookie(this._cookie);
      if (_(json).isString() && !_(json).isEmpty()) {
        var array = JSON.parse(json);
      
        if (_(array).isArray()) {          
          array = _(array).select(function(item) {
            return _(item).isArray() && _(item[0]).isString() && _(item[1]).isString() && !_(item[0]).isEmpty() && !_(item[1]).isEmpty();
          });
        
          this.reset(_(array).map(function(item) {
            return { 
              origin: item[0],
              destination: item[1] 
            }
          }));
        }
      }
    },
    
    toJSON: function() {
      return this.map(function(model) {
        return [model.get('origin'), model.get('destination')];
      });
    },
    
    expire: function() {
      this.each(function(favourite) {
        favourite.expire();
      });
    } 
  });
  
  /** All the application views: journey, journeys, page, about, settings, favourite, favourites */
  App.Views.Journey = Backbone.View.extend({
    tagName: 'li',
    className: 'journey',
    template: _.template($('#journey-template').html()),
  
    initialize: function() {
      _(this).bindAll('render');
      this.model.bind('change', this.render);
    },
    
    render: function() {
      $(this.el).html(this.template(this.model.toJSON()));
      return this;
    }
  });

  App.Views.Journeys = Backbone.View.extend({
    tagName: 'ol',
    
    initialize: function() {
      _(this).bindAll('render', 'add', 'remove');
      this.collection.bind('reset', this.render);
      this.collection.bind('add', this.add);
      this.collection.bind('remove', this.remove);
    },
    
    render: function() {
      $(this.el).empty();
      var self = this;
      self.collection.each(function(item) {
        self.add(item, false);
      });
      return self;
    },
    
    add: function(item, reveal) {      
      if (!_(reveal).isBoolean()) reveal = true;
    
      var html = $((new App.Views.Journey({ model: item, id: item.cid })).render().el);
      if (reveal) html.hide();
      $(this.el).append(html);
      if (reveal) html.slideDown();
    },
    
    remove: function(item) {
      flash($(this.el).find('#' + item.cid));
    }
  });

  App.Views.Page = Backbone.View.extend({
    tagName: 'div',
    className: 'page',
    
    initialize: function() {
      _(this).bindAll('render');
      if (!_(this.collection).isUndefined()) {
        this.collection.bind('add', this.render);
        this.collection.bind('reset', this.render);
        this.collection.bind('remove', this.render);
      }
    },
    
    render: function() {
      var header = $('<div id="header"></div>').html(this.header()),
          content = $('<div id="content"></div>').html(this.content()),
          footer = $('<div id="footer"></div>').html(this.footer());

      $(this.el).empty().append(header).append(content).append(footer);

      return this;
    },
    
    header: function() {
      return _.template($('#header-template').html());
    },
    
    content: function() {
      return $('');
    },
    
    footer: function() {
      return _.template($('#footer-template').html());
    }
  });

  App.Views.About = App.Views.Page.extend({
    id: 'about',
    
    events: {
       'click #header-right-button': 'done'
    },
    
    header: function() {
       return _.template($('#header-template').html());
    },
    
    content: function() {
       return _.template($('#about-template').html());
    },
    
    footer: function() {
       return $('');
    },
    
    done: function(e) {
       history.back();
       e.preventDefault();
    }
  });
  
  App.Views.Settings = App.Views.Page.extend({
    id: 'settings',
    
    events: {
      'click #header-right-button': 'done'
    },
    
    header: function() {
      return _.template($('#header-template').html());
    },
    
    content: function() {
      return _.template($('#settings-template').html(), { collection: this.collection.toJSON() });
    },
    
    footer: function() {
      return $('');
    },
    
    done: function(e) {
      // save changes!
      var self = this,
          changed = false,
          models = [],
          count = 0;
      
      self.$('form li').each(function() {
        var origin = $(this).find('input.origin').attr('value').trim().toTitleCase(),
            destination = $(this).find('input.destination').attr('value').trim().toTitleCase();
        
        if (!_(origin).isEmpty() && !_(destination).isEmpty()) {
          var favourite = self.collection.find(function(item) {
            return _(origin).isEqual(item.get('origin')) && _(destination).isEqual(item.get('destination'));
          });
        
          if (_(favourite).isUndefined()) {
            changed = true;
            models.push(new App.Models.Favourite({ origin: origin, destination: destination }));
          } else {
            models.push(favourite);
          }
          count++;
        }
      });
      self.collection.reset(models);
      self.collection.save();
      // is there a way to save the last journey being looked at so it can be returned to?
      if (this.collection.length > 0)
        window.location.hash = this.collection.first().url(false);
      e.preventDefault();
    }
  });
  
  App.Views.Favourite = App.Views.Page.extend({
    events: {
        'click button': 'load'
    },
    
    initialize: function(options) {
      _(this).bindAll('header', 'footer', 'content', 'load');
      this.partial = new App.Views.Journeys({ collection: this.model.journeys });
      this.inverse = false || options.inverse;
    },
    
    header: function() {
      return _.template($('#journey-header-template').html(), { url: this.model.inverse.url(), inverse: this.inverse });
    },
    
    content: function() {
      return $('<div class="journeys"></div>').append(this.partial.render().el).append(_.template($('#load-template').html())());
    },
    
    load: function() {
      var finished = false,
          button = this.$('button'),
          expire = button.attr('disabled', 'disabled').hasClass('expire-only');
      
      var animateLoader = function(element, isFinished) {
        var element = $(element),
            className = 'transparent',
            elements = element.find('span'),
            finished = isFinished;

        if (_.isFunction(isFinished)) finished = isFinished();
        
        if (finished) {
          elements.removeClass(className);
        } else {
          var invisible = elements.filter('.' + className).first();
          if (invisible.length > 0) {
            invisible.removeClass(className);
          } else {
            elements.addClass(className).first().removeClass(className);
          }
          window.setTimeout(function() { animateLoader(element, isFinished) }, 250);
        }
      };
      
      // animate the loading button, but only after 250 ms has passed in case action is super quick
      window.setTimeout(function() {
        animateLoader(button, function() { return finished });
      }, 250);
      
      if (expire) {
        this.model.journeys.expire(function() {
          button.removeClass('expire-only').removeAttr('disabled');
          finished = true;
        });
      } else {
        this.model.journeys.next(function() {
          button.removeAttr('disabled');
          finished = true;
        });
      }
    },
    
    footer: function() {
      return _.template($('#footer-template').html(), { collection: this.collection, index: this.collection.indexOf(this.model) });
    }
  });

  App.Views.Favourites = Backbone.View.extend({
    tagName: 'div',
    id: 'favourites',
    
    initialize: function(options) {
      _(this).bindAll('render');
      this.collection.bind('reset', this.render);
      this.collection.bind('add', this.render);
      this.collection.bind('remove', this.render);
    },
    
    render: function() {
      var self = this,
          partials = this.partials();
        
      $(self.el).empty();
      _(partials).each(function(partial) {
        $(self.el).append(partial.render().el);
      });

      // list of favourites might've changed, so fetch journeys
      $('button:not(.disabled)').addClass('expire-only').click();
      return self;
    },
    
    partials: function() {
      var self = this,
          list = undefined;
        
      list = self.collection.map(function(item) {
        return new App.Views.Favourite({ model: item, id: item.cid, collection: self.collection });
      });
      list = list.concat(self.collection.inverse().map(function(item) {
        return new App.Views.Favourite({ model: item, id: item.cid, collection: self.collection.inverse(), inverse: true });
      }));
    
      return list;
    }
  });
  
  /** All the application controllers: about, settings, journey */
  App.Routers.About = Backbone.Router.extend({
    routes: {
      '/about': 'about'
    },
    
    initialize: function(options) {
      this.view = new App.Views.About();
      $('body').append(this.view.render().el);
    },
    
    about: function() {
      transition('#' + this.view.id);
    }
  });

  App.Routers.Settings = Backbone.Router.extend({
    routes: {
      '/settings': 'settings'
    },
    
    initialize: function(options) {
      this.locations = options.locations;
      this.view = new App.Views.Settings({ collection: options.collection });
      $('body').append(this.view.render().el);
    },
    
    settings: function() {
      if (this.locations.length === 0) this.locations.fetch();
      transition('#' + this.view.id);
    }
  });

  App.Routers.Journey = Backbone.Router.extend({  
    routes: {
      '': 'root',
      '/': 'root',
      '/:origin/:destination': 'journey'
    },
    
    initialize: function(options) {
      this.collection = options.collection;
      this.view = new App.Views.Favourites({ collection: this.collection });
    
      // pre-render the element on the page, it won't be displayed until a journey url is accessed
      var element = this.view.render().el;
      $('body').append(element);
    },
    
    root: function() {
      // redirect to first favourite in list, or redirect to settings when no favourites exist
      window.location.hash = (this.collection.length > 0) ? this.collection.first().url(false) : '/settings';
    },
    
    journey: function(origin, destination) {
      origin = origin.unescape().toTitleCase();
      destination = destination.unescape().toTitleCase();
      var match = function(item) {
            return _(origin).isEqual(item.get('origin')) && _(destination).isEqual(item.get('destination'));
          },
          item = this.collection.find(match) || this.collection.inverse().find(match);
      
      if (_(item).isUndefined()) {
        // if the journey isn't already a favourite, add it to the favourites automatically and then display it
        if (this.collection.length < 7) {
          this.collection.add({ origin: origin, destination: destination });
          this.collection.save();
          item = this.collection.find(match);
          transition($('#' + item.cid));
        } else {
          window.location.hash = '/settings';
        }
      } else {
        transition($('#' + item.cid));
      }
    }
  });
  
  _(App).extend({
    favourites: new App.Models.Favourites(),
    locations: new App.Models.Locations(),
  
    initialize: function() {
      this.favourites.fetch();

      var about = new App.Routers.About(),
          settings = new App.Routers.Settings({ collection: this.favourites, locations: this.locations }),
          journeys = new App.Routers.Journey({ collection: this.favourites }),
          self = this;

      Backbone.history.start();

      // set up the autocomplete suggestions on the form input fields
      $('input.origin, input.destination').autocomplete({
      	minLength: 1,
      	source: function(request, response) {
      	  response(self.locations.search(request.term));
      	}
      });

      var run = function() {
        $('button:not(.disabled)').addClass('expire-only').click();
        window.setTimeout(run, (Date.now().next('minute') - Date.now()));
      };
      run();
    }
  });
  
  /** start the app */
  App.initialize();
});