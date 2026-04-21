const server = require('../index');
const jwt = require('jsonwebtoken');
const db = require('../src/resources/db');

const chai = require('chai');
const chaiHttp = require('chai-http');
chai.should();
chai.use(chaiHttp);
const { expect } = chai;

const TS = Date.now();

// ---- Worksites API ----

describe('Worksites API', () => {
  let managerToken;

  before(done => {
    const user = { username: `wsuser${TS}`, email: `wsuser${TS}@test.com`, password: 'password123' };
    chai.request(server).post('/api/auth/register').send(user).end((err, res) => {
      managerToken = jwt.sign({ id: res.body.user.id, role: 'manager' }, process.env.JWT_SECRET, { expiresIn: '1h' });
      done();
    });
  });

  after(done => {
    db.none('DELETE FROM worksites WHERE name = ANY($1)', [[`Test Worksite ${TS}`, `DB Test Worksite ${TS}`]])
      .then(() => db.none('DELETE FROM users WHERE email = $1', [`wsuser${TS}@test.com`]))
      .then(() => done()).catch(done);
  });

  it('Returns 201 and an id when creating a valid worksite', done => {
    chai
      .request(server)
      .post('/api/worksites')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: `Test Worksite ${TS}`, address: '123 Main St', lat: 39.7392, lng: -104.9903 })
      .end((err, res) => {
        expect(res).to.have.status(201);
        expect(res.body).to.have.property('id');
        done();
      });
  });

  it('Returns 400 when name is missing', done => {
    chai
      .request(server)
      .post('/api/worksites')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ lat: 39.7392, lng: -104.9903 })
      .end((err, res) => {
        expect(res).to.have.status(400);
        done();
      });
  });

  it('Returns 200 and an array from GET /api/worksites', done => {
    chai
      .request(server)
      .get('/api/worksites')
      .set('Authorization', `Bearer ${managerToken}`)
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.be.an('array');
        done();
      });
  });

  it('Created worksite appears in GET /api/worksites with correct lat/lng', done => {
    const name = `DB Test Worksite ${TS}`;
    chai.request(server)
      .post('/api/worksites')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name, lat: 40.0150, lng: -105.2705 })
      .end((err, res) => {
        expect(res).to.have.status(201);
        const id = res.body.id;
        chai.request(server)
          .get('/api/worksites')
          .set('Authorization', `Bearer ${managerToken}`)
          .end((err2, res2) => {
            expect(res2).to.have.status(200);
            const created = res2.body.find(w => w.id === id);
            expect(created).to.exist;
            expect(parseFloat(created.lat)).to.be.closeTo(40.0150, 0.0001);
            expect(parseFloat(created.lng)).to.be.closeTo(-105.2705, 0.0001);
            done();
          });
      });
  });

  it('Returns 403 when a worker tries to create a worksite', done => {
    const workerToken = jwt.sign({ id: 999, role: 'worker' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    chai
      .request(server)
      .post('/api/worksites')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ name: `Forbidden Worksite ${TS}`, address: 'Worker St', lat: 10, lng: 10 })
      .end((err, res) => {
        expect(res).to.have.status(403);
        done();
      });
  });
});
