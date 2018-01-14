'use strict';

var assert = require('assert');
var supertest = require('supertest');
var Koa = require('koa');
var BodyReceiver = require('../index');

describe('Body Receiver test json & urlencode', function () {
    var app = new Koa();
    var bodyReceiver = new BodyReceiver();

    app.use(bodyReceiver.startup());

    app.use((ctx, next) => {
        if (ctx.method === 'POST' && ctx.path === '/body/json') {
            ctx.body = ctx.request.body;
        }

        return next();
    });

    app.use((ctx, next) => {
        if (ctx.method === 'POST' && ctx.path === '/body/urlencode') {
            ctx.body = ctx.request.body;
        }

        return next();
    });

    app.use((ctx, next) => {
        if (ctx.method === 'POST' && ctx.path === '/body/fields') {
            ctx.body = ctx.request.body;
        }

        return next();
    });

    var request = supertest(app.listen());

    it('should receive json body', function (done) {
        var body = {
            name: 'chenmnkken',
            location: 'Beijing, China',
            website: 'http://stylechen.com/'
        };

        request
            .post('/body/json')
            .send(body)
            .set('content-type', 'application/json')
            .expect(200)
            .end(function (err, res) {
                if (err) {
                    return done(err);
                }

                assert.deepEqual(body, res.body);
                done();
            });
    });

    it('should receive urlencode body', function (done) {
        request
            .post('/body/urlencode')
            .send('name=chenmnkken')
            .send('location=Beijing, China')
            .send('website=http://stylechen.com/')
            .expect(200)
            .end(function (err, res) {
                if (err) {
                    return done(err);
                }

                var data = res.body;

                assert.equal(data.name, 'chenmnkken');
                assert.equal(data.location, 'Beijing, China');
                assert.equal(data.website, 'http://stylechen.com/');
                done();
            });
    });

    it('should receive urlencode body, and has same key', function (done) {
        request
            .post('/body/urlencode')
            .send('items=item1')
            .send('items=item2')
            .send('foo=bar')
            .expect(200)
            .end(function (err, res) {
                if (err) {
                    return done(err);
                }

                var data = res.body;

                assert.equal(data.items[0], 'item1');
                assert.equal(data.items[1], 'item2');
                assert.equal(data.foo, 'bar');
                done();
            });
    });

    it('should receive mutiple fields', function (done) {
        request
            .post('/body/fields')
            .field('name', 'chenmnkken')
            .field('location', 'Beijing, China')
            .field('website', 'http://stylechen.com/')
            .expect(200)
            .end(function (err, res) {
                if (err) {
                    return done(err);
                }

                var data = res.body;

                assert.equal(data.fields.name, 'chenmnkken');
                assert.equal(data.fields.location, 'Beijing, China');
                assert.equal(data.fields.website, 'http://stylechen.com/');
                assert.equal(Object.keys(data.files).length, 0);
                done();
            });
    });

});
