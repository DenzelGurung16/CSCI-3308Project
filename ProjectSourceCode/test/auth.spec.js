const server = require('../index');
const jwt = require('jsonwebtoken');
const db = require('../src/resources/db');

const chai = require('chai');
const chaiHttp = require('chai-http');
chai.should();
chai.use(chaiHttp);
const { expect } = chai;

const TS = Date.now();

// ---- Register API ----

describe('Register API', () => {
  after(done => {
    db.none('DELETE FROM users WHERE email = ANY($1)', [[`user${TS}@test.com`, `dup${TS}@test.com`]])
      .then(() => done()).catch(done);
  });

  it('Returns 201 for a valid registration', done => {
    chai
      .request(server)
      .post('/api/auth/register')
      .send({ username: `user${TS}`, email: `user${TS}@test.com`, password: 'password123' })
      .end((err, res) => {
        expect(res).to.have.status(201);
        expect(res.body).to.have.property('token');
        expect(res.body.user).to.include.keys('id', 'username', 'email', 'role');
        done();
      });
  });

  it('Returns 409 for a duplicate user', done => {
    const payload = { username: `dup${TS}`, email: `dup${TS}@test.com`, password: 'password123' };
    chai.request(server).post('/api/auth/register').send(payload).end(() => {
      chai
        .request(server)
        .post('/api/auth/register')
        .send(payload)
        .end((err, res) => {
          expect(res).to.have.status(409);
          done();
        });
    });
  });

  it('Returns 400 when required fields are missing', done => {
    chai
      .request(server)
      .post('/api/auth/register')
      .send({})
      .end((err, res) => {
        expect(res).to.have.status(400);
        done();
      });
  });
});

// ---- Login API ----

describe('Login API', () => {
  const loginUser = { username: `login${TS}`, email: `login${TS}@test.com`, password: 'password123' };

  before(done => {
    chai.request(server).post('/api/auth/register').send(loginUser).end(() => done());
  });

  after(done => {
    db.none('DELETE FROM users WHERE email = $1', [loginUser.email])
      .then(() => done()).catch(done);
  });

  it('Returns 200 and a token for valid credentials', done => {
    chai
      .request(server)
      .post('/api/auth/login')
      .send({ email: loginUser.email, password: loginUser.password })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.have.property('token');
        done();
      });
  });

  it('Returns 401 for invalid credentials', done => {
    chai
      .request(server)
      .post('/api/auth/login')
      .send({ email: loginUser.email, password: 'wrongpassword' })
      .end((err, res) => {
        expect(res).to.have.status(401);
        done();
      });
  });

  it('Returns 400 when fields are missing', done => {
    chai
      .request(server)
      .post('/api/auth/login')
      .send({})
      .end((err, res) => {
        expect(res).to.have.status(400);
        done();
      });
  });
});

// ---- Users List API ----

describe('Users List API', () => {
  let managerToken, workerToken;

  before(done => {
    const managerUser = { username: `listmgr${TS}`, email: `listmgr${TS}@test.com`, password: 'password123' };
    const workerUser = { username: `listwkr${TS}`, email: `listwkr${TS}@test.com`, password: 'password123' };
    
    chai.request(server).post('/api/auth/register').send(managerUser).end((err, res) => {
      // Manually sign a manager token for the first user
      managerToken = jwt.sign({ id: res.body.user.id, role: 'manager' }, process.env.JWT_SECRET, { expiresIn: '1h' });
      
      chai.request(server).post('/api/auth/register').send(workerUser).end((err2, res2) => {
        workerToken = res2.body.token; // Default role is worker
        done();
      });
    });
  });

  after(done => {
    db.none('DELETE FROM users WHERE email IN ($1, $2)', [`listmgr${TS}@test.com`, `listwkr${TS}@test.com`])
      .then(() => done()).catch(done);
  });

  it('Returns 200 and an array of users for a manager', done => {
    chai.request(server)
      .get('/api/users')
      .set('Authorization', `Bearer ${managerToken}`)
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.be.an('array');
        expect(res.body.length).to.be.at.least(2);
        expect(res.body[0]).to.include.keys('id', 'username');
        done();
      });
  });

  it('Returns 403 when a worker tries to access the list', done => {
    chai.request(server)
      .get('/api/users')
      .set('Authorization', `Bearer ${workerToken}`)
      .end((err, res) => {
        expect(res).to.have.status(403);
        done();
      });
  });

  it('Returns 401 when no token is provided', done => {
    chai.request(server)
      .get('/api/users')
      .end((err, res) => {
        expect(res).to.have.status(401);
        done();
      });
  });
});

// ---- Get User API ----

describe('Get User API', () => {
  let token;

  before(done => {
    const user = { username: `getuser${TS}`, email: `getuser${TS}@test.com`, password: 'password123' };
    chai.request(server).post('/api/auth/register').send(user).end((err, res) => {
      token = res.body.token;
      done();
    });
  });

  after(done => {
    db.none('DELETE FROM users WHERE email = $1', [`getuser${TS}@test.com`])
      .then(() => done()).catch(done);
  });

  it('Returns 200 with user data for a valid token', done => {
    chai
      .request(server)
      .get('/api/auth/get-user')
      .set('Authorization', `Bearer ${token}`)
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.have.property('user');
        done();
      });
  });

  it('Returns 401 when no token is provided', done => {
    chai
      .request(server)
      .get('/api/auth/get-user')
      .end((err, res) => {
        expect(res).to.have.status(401);
        done();
      });
  });

  it('Returns 401 for a malformed token', done => {
    chai
      .request(server)
      .get('/api/auth/get-user')
      .set('Authorization', 'Bearer this.is.garbage')
      .end((err, res) => {
        expect(res).to.have.status(401);
        done();
      });
  });
});

// ---- Update User API ----

describe('Update User API', () => {
  let token;

  before(done => {
    const user = { username: `updateuser${TS}`, email: `updateuser${TS}@test.com`, password: 'password123' };
    chai.request(server).post('/api/auth/register').send(user).end((err, res) => {
      token = res.body.token;
      done();
    });
  });

  after(done => {
    // email doesn't change, so this always finds the user even after username update
    db.none('DELETE FROM users WHERE email = $1', [`updateuser${TS}@test.com`])
      .then(() => done()).catch(done);
  });

  it('Returns 200 and updated user when username is changed', done => {
    chai
      .request(server)
      .patch('/api/auth/update-user')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: `updated${TS}` })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.user.username).to.equal(`updated${TS}`);
        done();
      });
  });

  it('Returns 400 when newPassword is provided without currentPassword', done => {
    chai
      .request(server)
      .patch('/api/auth/update-user')
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: 'newpass123' })
      .end((err, res) => {
        expect(res).to.have.status(400);
        done();
      });
  });

  it('Returns 401 for incorrect currentPassword', done => {
    chai
      .request(server)
      .patch('/api/auth/update-user')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'wrongpass', newPassword: 'newpass123' })
      .end((err, res) => {
        expect(res).to.have.status(401);
        done();
      });
  });

  it('Returns 401 when no token is provided', done => {
    chai
      .request(server)
      .patch('/api/auth/update-user')
      .send({ username: 'noToken' })
      .end((err, res) => {
        expect(res).to.have.status(401);
        done();
      });
  });

  it('Returns 409 when updating to a duplicate username', done => {
    const other = { username: `uuother${TS}`, email: `uuother${TS}@test.com`, password: 'password123' };
    chai.request(server).post('/api/auth/register').send(other).end(() => {
      chai.request(server)
        .patch('/api/auth/update-user')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: `uuother${TS}` })
        .end((err, res) => {
          db.none('DELETE FROM users WHERE email = $1', [`uuother${TS}@test.com`]).catch(() => {});
          expect(res).to.have.status(409);
          done();
        });
    });
  });

  it('Returns 400 when username is an empty string', done => {
    chai.request(server)
      .patch('/api/auth/update-user')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: '' })
      .end((err, res) => {
        expect(res).to.have.status(400);
        done();
      });
  });

  it('Returns 400 when email is an empty string', done => {
    chai.request(server)
      .patch('/api/auth/update-user')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: '' })
      .end((err, res) => {
        expect(res).to.have.status(400);
        done();
      });
  });
});
