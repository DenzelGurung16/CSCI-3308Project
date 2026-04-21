const server = require('../index');
const jwt = require('jsonwebtoken');
const db = require('../src/resources/db');

const chai = require('chai');
const chaiHttp = require('chai-http');
chai.should();
chai.use(chaiHttp);
const { expect } = chai;

const TS = Date.now();

// ---- Tasks API ----

describe('Tasks API', () => {
  let managerToken;

  before(done => {
    // Register a real user so created_by FK is satisfied, then mint a manager token with their ID
    const user = { username: `taskuser${TS}`, email: `taskuser${TS}@test.com`, password: 'password123' };
    chai.request(server).post('/api/auth/register').send(user).end((err, res) => {
      managerToken = jwt.sign({ id: res.body.user.id, role: 'manager' }, process.env.JWT_SECRET, { expiresIn: '1h' });
      done();
    });
  });

  after(done => {
    db.none(`DELETE FROM tasks WHERE title LIKE $1`, [`%${TS}`])
      .then(() => db.none('DELETE FROM users WHERE email = $1', [`taskuser${TS}@test.com`]))
      .then(() => done()).catch(done);
  });

  it('Returns 200 and an array from GET /api/tasks', done => {
    chai
      .request(server)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.be.an('array');
        done();
      });
  });

  it('Returns 400 when creating a task without a due_date', done => {
    chai
      .request(server)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: `No Date Task ${TS}`, status: 'backlog', priority: 'medium' })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body.error).to.equal('Due date is required');
        done();
      });
  });

  it('Returns 201 and an id when creating a valid task', done => {
    chai
      .request(server)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: `Test Task ${TS}`, status: 'backlog', priority: 'medium', due_date: '2026-12-31' })
      .end((err, res) => {
        expect(res).to.have.status(201);
        expect(res.body).to.have.property('id');
        done();
      });
  });

  it('Returns 400 when manager sends an invalid status', done => {
    chai.request(server)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: `Status Check ${TS}`, status: 'backlog', priority: 'low', due_date: '2026-12-31' })
      .end((err, res) => {
        const id = res.body.id;
        chai.request(server)
          .patch(`/api/tasks/${id}`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ status: 'invalid_status_value', due_date: '2026-12-31' })
          .end((err2, res2) => {
            expect(res2).to.have.status(400);
            expect(res2.body.error).to.equal('Invalid status value');
            done();
          });
      });
  });

  it('Returns 400 when manager sends an invalid priority', done => {
    chai.request(server)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: `Priority Check ${TS}`, status: 'backlog', priority: 'low', due_date: '2026-12-31' })
      .end((err, res) => {
        const id = res.body.id;
        chai.request(server)
          .patch(`/api/tasks/${id}`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ priority: 'super-high', due_date: '2026-12-31' })
          .end((err2, res2) => {
            expect(res2).to.have.status(400);
            expect(res2.body.error).to.equal('Invalid priority value');
            done();
          });
      });
  });

  it('Created task appears in GET /api/tasks', done => {
    const title = `Visible Task ${TS}`;
    chai.request(server)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: `Visible Task ${TS}`, status: 'in-progress', priority: 'high', due_date: '2026-12-31' })
      .end((err, res) => {
        expect(res).to.have.status(201);
        chai.request(server)
          .get('/api/tasks')
          .set('Authorization', `Bearer ${managerToken}`)
          .end((err2, res2) => {
            expect(res2).to.have.status(200);
            expect(res2.body.some(t => t.title === title)).to.be.true;
            done();
          });
      });
  });

  it('Returns 200 when updating an existing task', done => {
    chai.request(server)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: `Patch Me ${TS}`, status: 'backlog', priority: 'low', due_date: '2026-12-31' })
      .end((err, res) => {
        expect(res).to.have.status(201);
        const id = res.body.id;
        chai.request(server)
          .patch(`/api/tasks/${id}`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ title: `Patch Me ${TS}`, status: 'in-progress', priority: 'high', due_date: '2026-12-31' })
          .end((err2, res2) => {
            expect(res2).to.have.status(200);
            expect(res2.body.success).to.be.true;
            done();
          });
      });
  });

  it('Returns 404 when updating a non-existent task', done => {
    chai
      .request(server)
      .patch('/api/tasks/999999')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: 'ghost', status: 'backlog', priority: 'low', due_date: '2026-12-31' })
      .end((err, res) => {
        expect(res).to.have.status(404);
        done();
      });
  });

  it('Returns 200 and an array from GET /api/tasks/map', done => {
    chai
      .request(server)
      .get('/api/tasks/map')
      .set('Authorization', `Bearer ${managerToken}`)
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.be.an('array');
        done();
      });
  });

  it('Returns 200 and an array from GET /api/tasks/:id/worksite-history', done => {
    chai.request(server)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: `History Task ${TS}`, status: 'backlog', priority: 'low', due_date: '2026-12-31' })
      .end((err, res) => {
        expect(res).to.have.status(201);
        const id = res.body.id;
        chai.request(server)
          .get(`/api/tasks/${id}/worksite-history`)
          .set('Authorization', `Bearer ${managerToken}`)
          .end((err2, res2) => {
            expect(res2).to.have.status(200);
            expect(res2.body).to.be.an('array');
            done();
          });
      });
  });

  it('Returns 204 when deleting an existing task', done => {
    chai.request(server)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: `Delete Me ${TS}`, status: 'backlog', priority: 'low', due_date: '2026-12-31' })
      .end((err, res) => {
        expect(res).to.have.status(201);
        const id = res.body.id;
        chai.request(server)
          .delete(`/api/tasks/${id}`)
          .set('Authorization', `Bearer ${managerToken}`)
          .end((err2, res2) => {
            expect(res2).to.have.status(204);
            done();
          });
      });
  });

  it('Returns 404 when deleting a non-existent task', done => {
    chai
      .request(server)
      .delete('/api/tasks/999999')
      .set('Authorization', `Bearer ${managerToken}`)
      .end((err, res) => {
        expect(res).to.have.status(404);
        done();
      });
  });
});

// ---- Role Enforcement ----

describe('Role Enforcement', () => {
  let managerToken, workerToken, taskId, assignedTaskId, workerUsername;

  before(done => {
    workerUsername = `rewkr${TS}`;
    const manager = { username: `remgr${TS}`,   email: `remgr${TS}@test.com`, password: 'password123' };
    const worker  = { username: workerUsername,  email: `rewkr${TS}@test.com`, password: 'password123' };

    chai.request(server).post('/api/auth/register').send(manager).end((err, res) => {
      managerToken = jwt.sign({ id: res.body.user.id, role: 'manager' }, process.env.JWT_SECRET, { expiresIn: '1h' });

      chai.request(server).post('/api/auth/register').send(worker).end((err2, res2) => {
        workerToken = jwt.sign({ id: res2.body.user.id, role: 'worker' }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Unassigned task — worker should be blocked from editing this
        chai.request(server)
          .post('/api/tasks')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ title: `RE Task ${TS}`, status: 'backlog', priority: 'low', due_date: '2026-12-31' })
          .end((err3, res3) => {
            taskId = res3.body.id;

            // Assigned task — worker should be able to update status on this
            chai.request(server)
              .post('/api/tasks')
              .set('Authorization', `Bearer ${managerToken}`)
              .send({ title: `RE Assigned ${TS}`, status: 'backlog', priority: 'low', assignee: workerUsername, due_date: '2026-12-31' })
              .end((err4, res4) => {
                assignedTaskId = res4.body.id;
                done();
              });
          });
      });
    });
  });

  after(done => {
    db.none('DELETE FROM tasks WHERE title = ANY($1)', [[`RE Task ${TS}`, `RE Assigned ${TS}`]])
      .then(() => db.none('DELETE FROM users WHERE email = ANY($1)', [[`remgr${TS}@test.com`, `rewkr${TS}@test.com`]]))
      .then(() => done()).catch(done);
  });

  it('Returns 403 when worker tries to create a task', done => {
    chai.request(server)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ title: 'Should fail', status: 'backlog', priority: 'low' })
      .end((err, res) => {
        expect(res).to.have.status(403);
        done();
      });
  });

  it('Returns 403 when worker tries to update an unassigned task', done => {
    chai.request(server)
      .patch(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ status: 'in-progress' })
      .end((err, res) => {
        expect(res).to.have.status(403);
        done();
      });
  });

  it('Returns 200 when worker updates status on an assigned task', done => {
    chai.request(server)
      .patch(`/api/tasks/${assignedTaskId}`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ status: 'in-progress' })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.success).to.be.true;
        done();
      });
  });

  it('Returns 400 when worker sends an invalid status value', done => {
    chai.request(server)
      .patch(`/api/tasks/${assignedTaskId}`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ status: 'not-a-real-status' })
      .end((err, res) => {
        expect(res).to.have.status(400);
        done();
      });
  });

  it('Returns 403 when worker tries to delete a task', done => {
    chai.request(server)
      .delete(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${workerToken}`)
      .end((err, res) => {
        expect(res).to.have.status(403);
        done();
      });
  });

  it('Returns 403 when worker tries to access the task map', done => {
    chai.request(server)
      .get('/api/tasks/map')
      .set('Authorization', `Bearer ${workerToken}`)
      .end((err, res) => {
        expect(res).to.have.status(403);
        done();
      });
  });

  it('Returns 403 when worker tries to create a worksite', done => {
    chai.request(server)
      .post('/api/worksites')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ name: `Worker WS ${TS}`, lat: 0, lng: 0 })
      .end((err, res) => {
        expect(res).to.have.status(403);
        done();
      });
  });

  it('Returns 401 for unauthenticated GET /api/tasks', done => {
    chai.request(server)
      .get('/api/tasks')
      .end((err, res) => {
        expect(res).to.have.status(401);
        done();
      });
  });

  it('Returns 401 for unauthenticated GET /api/worksites', done => {
    chai.request(server)
      .get('/api/worksites')
      .end((err, res) => {
        expect(res).to.have.status(401);
        done();
      });
  });
});

// ---- Worker Task Filtering ----

describe('Worker Task Filtering', () => {
  let managerToken, workerToken, assignedTaskId, unassignedTaskId, workerUsername;

  before(done => {
    workerUsername = `wfwkr${TS}`;
    const manager = { username: `wfmgr${TS}`, email: `wfmgr${TS}@test.com`, password: 'password123' };
    const worker  = { username: workerUsername, email: `wfwkr${TS}@test.com`, password: 'password123' };

    chai.request(server).post('/api/auth/register').send(manager).end((err, res) => {
      managerToken = jwt.sign({ id: res.body.user.id, role: 'manager' }, process.env.JWT_SECRET, { expiresIn: '1h' });

      chai.request(server).post('/api/auth/register').send(worker).end((err2, res2) => {
        workerToken = jwt.sign({ id: res2.body.user.id, role: 'worker' }, process.env.JWT_SECRET, { expiresIn: '1h' });

        chai.request(server)
          .post('/api/tasks')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ title: `WF Assigned ${TS}`, status: 'backlog', priority: 'low', assignee: workerUsername, due_date: '2026-12-31' })
          .end((err3, res3) => {
            assignedTaskId = res3.body.id;

            chai.request(server)
              .post('/api/tasks')
              .set('Authorization', `Bearer ${managerToken}`)
              .send({ title: `WF Unassigned ${TS}`, status: 'backlog', priority: 'low', due_date: '2026-12-31' })
              .end((err4, res4) => {
                unassignedTaskId = res4.body.id;
                done();
              });
          });
      });
    });
  });

  after(done => {
    db.none('DELETE FROM tasks WHERE title = ANY($1)', [[`WF Assigned ${TS}`, `WF Unassigned ${TS}`]])
      .then(() => db.none('DELETE FROM users WHERE email = ANY($1)', [[`wfmgr${TS}@test.com`, `wfwkr${TS}@test.com`]]))
      .then(() => done()).catch(done);
  });

  it('Worker sees a task they are assigned to', done => {
    chai.request(server)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${workerToken}`)
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.some(t => t.id === assignedTaskId)).to.be.true;
        done();
      });
  });

  it('Worker does not see tasks they are not assigned to', done => {
    chai.request(server)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${workerToken}`)
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.some(t => t.id === unassignedTaskId)).to.be.false;
        done();
      });
  });
});

// ---- Task Assignment Persistence ----

describe('Task Assignment Persistence', () => {
  let managerToken, workerId, workerUsername, workerUsername2;

  before(done => {
    workerUsername  = `tapwkr1${TS}`;
    workerUsername2 = `tapwkr2${TS}`;
    const manager = { username: `tapmgr${TS}`,  email: `tapmgr${TS}@test.com`,  password: 'password123' };
    const worker1 = { username: workerUsername,  email: `tapwkr1${TS}@test.com`, password: 'password123' };
    const worker2 = { username: workerUsername2, email: `tapwkr2${TS}@test.com`, password: 'password123' };

    chai.request(server).post('/api/auth/register').send(manager).end((err, res) => {
      managerToken = jwt.sign({ id: res.body.user.id, role: 'manager' }, process.env.JWT_SECRET, { expiresIn: '1h' });
      chai.request(server).post('/api/auth/register').send(worker1).end((err2, res2) => {
        workerId = res2.body.user.id;
        chai.request(server).post('/api/auth/register').send(worker2).end(() => done());
      });
    });
  });

  after(done => {
    db.none(`DELETE FROM tasks WHERE title LIKE $1`, [`TAP %${TS}`])
      .then(() => db.none('DELETE FROM users WHERE email = ANY($1)', [[`tapmgr${TS}@test.com`, `tapwkr1${TS}@test.com`, `tapwkr2${TS}@test.com`]]))
      .then(() => done()).catch(done);
  });

  it('Creates a task_assignments row when assignee username matches a user', done => {
    chai.request(server)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: `TAP Assign ${TS}`, status: 'backlog', priority: 'low', assignee: workerUsername, due_date: '2026-12-31' })
      .end((err, res) => {
        expect(res).to.have.status(201);
        const taskId = res.body.id;
        db.oneOrNone(
          `SELECT * FROM task_assignments WHERE task_id = $1 AND user_id = $2 AND role = 'assignee'`,
          [taskId, workerId]
        ).then(row => {
          expect(row).to.exist;
          done();
        }).catch(done);
      });
  });

  it('Updating assignee replaces the task_assignments row', done => {
    chai.request(server)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: `TAP Update ${TS}`, status: 'backlog', priority: 'low', assignee: workerUsername, due_date: '2026-12-31' })
      .end((err, res) => {
        expect(res).to.have.status(201);
        const taskId = res.body.id;
        chai.request(server)
          .patch(`/api/tasks/${taskId}`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ title: `TAP Update ${TS}`, status: 'backlog', priority: 'low', assignee: workerUsername2, due_date: '2026-12-31' })
          .end((err2, res2) => {
            expect(res2).to.have.status(200);
            db.any(`SELECT * FROM task_assignments WHERE task_id = $1`, [taskId])
              .then(rows => {
                expect(rows).to.have.length(1);
                expect(rows[0].user_id).to.not.equal(workerId);
                done();
              }).catch(done);
          });
      });
  });

  it('Returns 400 when assignee username does not match any user', done => {
    chai.request(server)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: `TAP NoUser ${TS}`, status: 'backlog', priority: 'low', assignee: 'nonexistent_xyz', due_date: '2026-12-31' })
      .end((err, res) => {
        expect(res).to.have.status(400);
        done();
      });
  });
});

// ---- Worksite History Scoping ----

describe('Worksite History Scoping', () => {
  let managerToken, assignedWorkerToken, unassignedWorkerToken, taskId;

  before(done => {
    const manager          = { username: `whsmgr${TS}`,  email: `whsmgr${TS}@test.com`,  password: 'password123' };
    const assignedWorker   = { username: `whswkr1${TS}`, email: `whswkr1${TS}@test.com`, password: 'password123' };
    const unassignedWorker = { username: `whswkr2${TS}`, email: `whswkr2${TS}@test.com`, password: 'password123' };

    chai.request(server).post('/api/auth/register').send(manager).end((err, res) => {
      managerToken = jwt.sign({ id: res.body.user.id, role: 'manager' }, process.env.JWT_SECRET, { expiresIn: '1h' });

      chai.request(server).post('/api/auth/register').send(assignedWorker).end((err2, res2) => {
        assignedWorkerToken = jwt.sign({ id: res2.body.user.id, role: 'worker' }, process.env.JWT_SECRET, { expiresIn: '1h' });

        chai.request(server).post('/api/auth/register').send(unassignedWorker).end((err3, res3) => {
          unassignedWorkerToken = jwt.sign({ id: res3.body.user.id, role: 'worker' }, process.env.JWT_SECRET, { expiresIn: '1h' });

          chai.request(server)
            .post('/api/tasks')
            .set('Authorization', `Bearer ${managerToken}`)
            .send({ title: `WHS Task ${TS}`, status: 'backlog', priority: 'low', assignee: `whswkr1${TS}`, due_date: '2026-12-31' })
            .end((err4, res4) => {
              taskId = res4.body.id;
              done();
            });
        });
      });
    });
  });

  after(done => {
    db.none('DELETE FROM tasks WHERE title = $1', [`WHS Task ${TS}`])
      .then(() => db.none('DELETE FROM users WHERE email = ANY($1)', [[`whsmgr${TS}@test.com`, `whswkr1${TS}@test.com`, `whswkr2${TS}@test.com`]]))
      .then(() => done()).catch(done);
  });

  it('Manager can view worksite history for any task', done => {
    chai.request(server)
      .get(`/api/tasks/${taskId}/worksite-history`)
      .set('Authorization', `Bearer ${managerToken}`)
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.be.an('array');
        done();
      });
  });

  it('Assigned worker can view worksite history for their task', done => {
    chai.request(server)
      .get(`/api/tasks/${taskId}/worksite-history`)
      .set('Authorization', `Bearer ${assignedWorkerToken}`)
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.be.an('array');
        done();
      });
  });

  it('Unassigned worker cannot view worksite history for another task', done => {
    chai.request(server)
      .get(`/api/tasks/${taskId}/worksite-history`)
      .set('Authorization', `Bearer ${unassignedWorkerToken}`)
      .end((err, res) => {
        expect(res).to.have.status(403);
        done();
      });
  });
});
