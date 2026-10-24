# Auth testing
- Users in `users` collection (string `id`, bcrypt `password_hash` starting `$2b$`), unique index on email.
- Login: `curl -c cookies.txt -X POST $API/api/auth/login -H "Content-Type: application/json" -d '{"email":"host@bullpup.example.com","password":"bullpup123"}'`
- Then `curl -b cookies.txt $API/api/auth/me` returns the host.
- Cookies: httpOnly `access_token` + `refresh_token`. Bearer header fallback also accepted.
- 5 failed logins per ip+email → 15 minute lockout (429).
