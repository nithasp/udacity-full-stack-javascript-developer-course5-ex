# API Testing (cURL)

> Base URL: `http://localhost:3000` — run `npm run watch` first.

---

## Quick Walkthrough

```bash
# 1. Register and save tokens
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"John","lastName":"Doe","username":"johndoe","password":"pass1234"}'

TOKEN="your.access.token"

# 2. Create products
curl -s -X POST http://localhost:3000/products \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Keyboard","price":49.99,"category":"electronics"}'

curl -s -X POST http://localhost:3000/products \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Mouse","price":29.99,"category":"electronics"}'

# 3. Add items to cart and checkout
curl -s -X POST http://localhost:3000/cart \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"productId":1,"quantity":2}'

curl -s -X POST http://localhost:3000/cart/checkout \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"items":[{"productId":1,"quantity":2},{"productId":2,"quantity":1}]}'

# 4. Most popular products
curl http://localhost:3000/products/popular
```

---

## Auth

**Register** (returns `accessToken` + `refreshToken`):
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"John","lastName":"Doe","username":"johndoe","password":"pass1234"}'
```

**Login:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"johndoe","password":"pass1234"}'
```

**Refresh access token:**
```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"your.refresh.token"}'
```

**Get current user:**
```bash
curl http://localhost:3000/auth/me -H "Authorization: Bearer $TOKEN"
```

**Logout:**
```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"your.refresh.token"}'
```

**Logout all sessions:**
```bash
curl -X POST http://localhost:3000/auth/logout-all -H "Authorization: Bearer $TOKEN"
```

---

## Users

> All user routes require `Authorization: Bearer <token>`.

**List all users:**
```bash
curl http://localhost:3000/users -H "Authorization: Bearer $TOKEN"
```

**Get user by id** (includes 5 most recent purchases):
```bash
curl http://localhost:3000/users/1 -H "Authorization: Bearer $TOKEN"
```

**Create user (admin):**
```bash
curl -X POST http://localhost:3000/users \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"firstName":"Jane","lastName":"Smith","username":"janesmith","password":"pass1234"}'
```

**Update user:**
```bash
curl -X PUT http://localhost:3000/users/1 \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"firstName":"Jane"}'
```

**Delete user:**
```bash
curl -X DELETE http://localhost:3000/users/1 -H "Authorization: Bearer $TOKEN"
```

---

## Products

**Create product:**
```bash
curl -X POST http://localhost:3000/products \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Widget","price":9.99,"category":"gadgets"}'
```

**List all / filter by category:**
```bash
curl http://localhost:3000/products
curl "http://localhost:3000/products?category=gadgets"
```

**Most popular (ranked by total quantity ordered):**
```bash
curl http://localhost:3000/products/popular
```

**Get / Update / Delete:**
```bash
curl http://localhost:3000/products/1

curl -X PUT http://localhost:3000/products/1 \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"price":14.99}'

curl -X DELETE http://localhost:3000/products/1 -H "Authorization: Bearer $TOKEN"
```

---

## Orders

**Create order:**
```bash
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"user_id":1}'
```

**Add product to order:**
```bash
curl -X POST http://localhost:3000/orders/1/products \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"product_id":1,"quantity":3}'
```

**List / filter orders:**
```bash
curl http://localhost:3000/orders -H "Authorization: Bearer $TOKEN"
curl "http://localhost:3000/orders?status=active&userId=1" -H "Authorization: Bearer $TOKEN"
```

**Get / Update / Delete:**
```bash
curl http://localhost:3000/orders/1 -H "Authorization: Bearer $TOKEN"
curl http://localhost:3000/orders/1/products -H "Authorization: Bearer $TOKEN"

curl -X PUT http://localhost:3000/orders/1 \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"complete"}'

curl -X DELETE http://localhost:3000/orders/1 -H "Authorization: Bearer $TOKEN"
```

**User order queries:**
```bash
curl http://localhost:3000/orders/user/1/current   -H "Authorization: Bearer $TOKEN"
curl http://localhost:3000/orders/user/1/completed -H "Authorization: Bearer $TOKEN"
```

---

## Cart

> All cart routes require `Authorization: Bearer <token>`.

**Get cart:**
```bash
curl http://localhost:3000/cart -H "Authorization: Bearer $TOKEN"
```

**Add item** (increments quantity if same product+type already exists):
```bash
curl -X POST http://localhost:3000/cart \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"productId":1,"quantity":2}'
```

**Update item quantity:**
```bash
curl -X PUT http://localhost:3000/cart/1 \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"quantity":5}'
```

**Remove item:**
```bash
curl -X DELETE http://localhost:3000/cart/1 -H "Authorization: Bearer $TOKEN"
```

**Clear cart:**
```bash
curl -X DELETE http://localhost:3000/cart -H "Authorization: Bearer $TOKEN"
```

**Checkout** (creates a completed order and clears the cart):
```bash
curl -X POST http://localhost:3000/cart/checkout \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"items":[{"productId":1,"quantity":2},{"productId":2,"quantity":1}]}'
```

---

## Addresses

> All address routes require `Authorization: Bearer <token>`.

**List addresses:**
```bash
curl http://localhost:3000/addresses -H "Authorization: Bearer $TOKEN"
```

**Get address:**
```bash
curl http://localhost:3000/addresses/1 -H "Authorization: Bearer $TOKEN"
```

**Create address:**
```bash
curl -X POST http://localhost:3000/addresses \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"fullName":"John Doe","address":"123 Main St","city":"New York","phone":"555-1234","label":"home","isDefault":true}'
```

**Update address:**
```bash
curl -X PUT http://localhost:3000/addresses/1 \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"city":"Brooklyn","isDefault":true}'
```

**Delete address:**
```bash
curl -X DELETE http://localhost:3000/addresses/1 -H "Authorization: Bearer $TOKEN"
```
