const server = require('../index');

const chai = require('chai');
const chaiHttp = require('chai-http');
chai.should();
chai.use(chaiHttp);
const { assert, expect } = chai;

// ---- Welcome ----

describe('Server!', () => {
  it('Returns the default welcome message', done => {
    chai
      .request(server)
      .get('/welcome')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.status).to.equals('success');
        assert.strictEqual(res.body.message, 'Welcome!');
        done();
      });
  });
});

// ---- Session Persistence ----

describe('Session Persistence', () => {
  it('Persists session data across requests (visit counter increments)', done => {
    const agent = chai.request.agent(server);
    agent
      .get('/welcome')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.visits).to.equal(1);
        agent
          .get('/welcome')
          .end((err2, res2) => {
            expect(res2).to.have.status(200);
            expect(res2.body.visits).to.equal(2);
            agent.close();
            done();
          });
      });
  });
});

// ---- Config API ----

describe('Config API', () => {
  it('Returns 200 with a googleMapsKey field', done => {
    chai
      .request(server)
      .get('/api/config')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.have.property('googleMapsKey');
        done();
      });
  });
});

// ---- Service Status API ----

describe('Service Status API', () => {
  it('Returns a status object with service health details', done => {
    chai
      .request(server)
      .get('/api/service-status')
      .end((err, res) => {
        expect(res.status).to.be.oneOf([200, 503]);
        expect(res.body).to.have.property('status');
        expect(res.body).to.have.property('services');
        expect(res.body.services).to.have.property('database');
        done();
      });
  });
});
