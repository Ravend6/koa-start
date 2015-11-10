'use strict';

var Router = require('koa-router');
var _ = require('lodash');
var co = require('co');
var slug = require('slug');

var router = new Router();
var Forum = require('../models/forum');
var User = require('../models/user');
var policy = require('../middleware/policy');

router.get('index', '/forums', function * (next) {
  var ctx = this;
  yield co(function * () {
    try {
      var forums = yield Forum
        .find({
          isVisible: true
        })
        .sort('position')
        .populate('moderators', 'displayName')
        .exec();
      yield ctx.render('forums/index', {
        forums
      });
    } catch (e) {
      ctx.throw(500);
    }
  });
});

router.get('new', '/admin/forums/new', function * (next) {
  var forums = yield co(function * () {
    return yield Forum
      .find()
      .sort('position')
      .populate('moderators')
      .exec();
  });
  var moderators = yield co(function * () {
    return yield User
      .find({
        roles: 'moderator'
      })
      .sort('displayName')
      .exec();
  });
  var noneModerators = moderators.length === 0 ? true : false;

  var accessArray = Forum.accessEnum();
  var access = [];
  for (let a of accessArray) {
    access.push({
      name: a,
      selected: true
    });
  }

  var forum = {
    isVisible: true,
    position: forums.length + 1,
    moderators: moderators,
    access: access,
    noneModerators: noneModerators
  };
  yield this.render('forums/new', {
    forum
  });
});

router.post('/admin/forums/new', function * (next) {
  var ctx = this;
  var form = this.request.body;
  form.slug = slug(form.title, {
    lower: true
  });
  // unique slug
  var countSLug = yield co(function * () {
    return yield Forum.count({
      slug: form.slug
    }).exec();
  });
  if (countSLug) {
    form.slug += Math.floor((Math.random() * 1000) + 1);
  }

  yield co(function * () {
    try {
      var forum = new Forum(form);
      yield forum.save();
      ctx.setFlash('success', 'Новый форум успешно создан.');
      ctx.redirect(router.url('show', forum.slug));
    } catch (e) {
      ctx.setFlash('danger', ctx.getErrors(e));
      ctx.redirect(router.url('new'));
    }
  });
});

router.get('edit', '/admin/forums/:id/edit', function * (next) {
  var forum = this.forum.toObject();

  var moderators = yield co(function * () {
    return yield User
      .find({
        roles: 'moderator'
      })
      .sort('displayName')
      .exec();
  });

  // access
  var access = [];
  var accessArray = Forum.accessEnum();
  for (let a of accessArray) {
    if (forum.access.indexOf(a) !== -1) {
      access.push({
        name: a,
        selected: true
      });
    } else {
      access.push({
        name: a,
        selected: false
      });

    }
  }
  forum.access = access;

  // moderators
  forum.noneModerators = moderators.length === 0 ? true : false;
  var selectedModerators = [];
  if (!forum.noneModerators && forum.moderators.length > 0) {
    for (let m of moderators) {
      var index = _.findIndex(forum.moderators, function (chr) {
        return JSON.stringify(chr) === JSON.stringify(m.id);
      });

      if (index !== -1) {
        selectedModerators.push({
          _id: m.id,
          displayName: m.displayName,
          selected: true
        });
      } else {
        selectedModerators.push({
          _id: m.id,
          displayName: m.displayName,
          selected: false
        });
      }
    }

    forum.moderators = selectedModerators;
  } else {
    forum.moderators = moderators;
  }
  yield this.render('forums/edit', {
    forum: forum
  });
});

router.put('/admin/forums/:id/edit', function * (next) {
  var ctx = this;

  var updatedForum = {};
  var forum = this.request.body;
  if (ctx.forum.title !== forum.title) {
    updatedForum.title = forum.title;
  }
  if (ctx.forum.slug !== forum.slug) {
    updatedForum.slug = forum.slug;
  }
  updatedForum.description = forum.description;
  updatedForum.position = forum.position;
  updatedForum.isVisible = forum.isVisible;
  updatedForum.access = forum.access || [];
  updatedForum.moderators = forum.moderators || [];

  yield co(function * () {
    try {
      yield ctx.forum.update(updatedForum, {
        upsert: true
      }).exec();
      ctx.setFlash('success', 'Форум успешно обновлен.');
      ctx.redirect(router.url('index'));
    } catch (e) {
      ctx.setFlash('danger', ctx.getErrors(e));
      ctx.redirect(router.url('edit', ctx.forum.id));
    }
  });
});

router.get('show', '/forums/:slug', function * (next) {
  var ctx = this;

  yield co(function * () {
    try {
      var forum = yield Forum.findOne({
        slug: ctx.params.slug
      }).exec();
      if (!forum) return ctx.throw(404);
      ctx.forum = forum;
    } catch (e) {
      return ctx.throw(404);
    }
  });
  yield this.render('forums/show', {
    forum: this.forum
  });
});

router.delete('delete', '/admin/forums/:id', function * (next) {
  var ctx = this;
  yield co(function * () {
    try {
      yield ctx.forum.remove();
      ctx.setFlash('success', 'Форум успешно удален.');
      ctx.redirect(router.url('index'));
    } catch (e) {
      ctx.throw(500);
    }
  });
});

router.param('id', function * (id, next) {
  var ctx = this;
  yield co(function * () {
    try {
      var forum = yield Forum.findById(ctx.params.id).exec();
      if (!forum) ctx.throw(404);
      ctx.forum = forum;
    } catch (e) {
      return ctx.throw(404);
    }
  });
  yield next;
});

module.exports = router;