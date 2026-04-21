-- worker user: steve / steve@steve.com / password: steve
INSERT INTO users (username, email, password_hash, role)
VALUES ('steve', 'steve@steve.com', '$2b$10$Hzd9l6rrDL0LfxNqYVOO/ukzm41/0MiiTvhHD5kkSOYn5inPUka.C', 'worker')
ON CONFLICT DO NOTHING;

-- worker user: joe / joe@joe.com / password: joe
INSERT INTO users (username, email, password_hash, role)
VALUES ('joe', 'joe@joe.com', '$2b$10$DRKX92WrABkIPl1UbP82G.IP7AWMB1Omh6Me5SvHHLyriz9L3jxaC', 'worker')
ON CONFLICT DO NOTHING;

-- worker user: sam / sam@sam.com / password: sam
INSERT INTO users (username, email, password_hash, role)
VALUES ('sam', 'sam@sam.com', '$2b$10$WHAPtLYC4SeUpjNElhMfx.e1.RHT0A3adxqNZS89oZa/3DIYn0Ota', 'worker')
ON CONFLICT DO NOTHING;

-- admin user: meow / meow@meow.com / password: meow
INSERT INTO users (username, email, password_hash, role)
VALUES ('meow', 'meow@meow.com', '$2b$10$lLditLtNkSZe51alQHwqz.3LfRLTJGVJm7dmTTQYyp0qRPaJsUQa.', 'admin')
ON CONFLICT DO NOTHING;
