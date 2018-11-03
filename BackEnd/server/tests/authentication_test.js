const expect = require('expect');
const request = require('supertest');
const { ObjectID } = require('mongodb');

const app = require('./../server');
const User = require('../models/user');
const auth_helper = require('./services/authentication_service.js');


describe('Authentication Suite', function () {
    this.timeout(10000);
    let newUser;
    it('Register a user', (done) => {
        auth_helper.registerUser().then((registeredUser) => {
            newUser=registeredUser;
            done();
        });

    });
    it('Logout with user', (done) => {
        User.find({ username: newUser.username }).then(dbUser => {
            request(app)
                .delete('/authenticated/logout')
                .set('x-auth', dbUser[0].tokens[0].token)
                .expect(200)
                .end((err, res) => {
                    User.find({ username: newUser.username }).then(dbUser => {
                        expect(dbUser[0].tokens.length).toBe(0, 'Token array is not empty after logout');
                        done();
                    }).catch((e) => done(e));
                });
        }).catch((e) => done(e));

     })
    it('Login with user', (done) => {
        request(app)
            .post('/login')
            .send(newUser)
            .expect(200)
            .expect(res => {
                expect(typeof (res.header['x-auth'])).toBe('string', 'x-auth token type does not match');
            })
            .end((err, res) => {
                if (err) return done(err);
                User.find({ username: newUser.username }).then(dbUser => {
                    expect(dbUser[0].username).toBe(newUser.username);
                    expect(dbUser[0].tokens.length).toBe(1, 'Token array doesn\'t have length 1');
                    done();
                }).catch((e) => done(e));
            })
    })
});