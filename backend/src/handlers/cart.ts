import { Application, Request, Response } from 'express';
import { CartStore } from '../models/cart';
import { OrderStore } from '../models/order';
import { verifyAuthToken } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, sendSuccess } from '../utils/response';
import { parseId, requirePositiveInt } from '../utils/validate';
import client from '../database';

const cartStore = new CartStore();
const orderStore = new OrderStore();

// GET /cart  — return all cart items for the authenticated user
const getCart = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  sendSuccess(res, await cartStore.getByUser(userId), 'Cart fetched.');
});

// POST /cart  — add (or increment) a cart item
const addItem = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const productId   = requirePositiveInt(req.body.productId, 'productId');
  const quantity    = requirePositiveInt(req.body.quantity ?? 1, 'quantity');

  const typeId       = req.body.typeId      ?? null;
  const selectedType = req.body.selectedType ?? null;
  const shopId       = req.body.shopId      ?? null;
  const shopName     = req.body.shopName    ?? null;

  const item = await cartStore.upsert(userId, {
    productId,
    quantity,
    typeId,
    selectedType,
    shopId,
    shopName,
  });

  sendSuccess(res, item, 'Item added to cart.', 201);
});

// PUT /cart/:id  — set exact quantity for a cart item
const updateItem = asyncHandler(async (req: Request, res: Response) => {
  const userId     = req.user!.userId;
  const cartItemId = parseId(req.params.id, 'cart item id');
  const quantity   = requirePositiveInt(req.body.quantity, 'quantity');

  const updated = await cartStore.updateQuantity(cartItemId, userId, quantity);
  if (!updated) throw new AppError(`Cart item ${cartItemId} not found`, 404);

  sendSuccess(res, updated, 'Cart item updated.');
});

// DELETE /cart/:id  — remove a single cart item
const removeItem = asyncHandler(async (req: Request, res: Response) => {
  const userId     = req.user!.userId;
  const cartItemId = parseId(req.params.id, 'cart item id');

  const deleted = await cartStore.remove(cartItemId, userId);
  if (!deleted) throw new AppError(`Cart item ${cartItemId} not found`, 404);

  sendSuccess(res, deleted, 'Cart item removed.');
});

// DELETE /cart  — clear ALL cart items for the authenticated user
const clearCart = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  await cartStore.clearByUser(userId);
  sendSuccess(res, null, 'Cart cleared.');
});

// POST /cart/checkout  — create a completed order from selected cart items, then clear cart
const checkout = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const items: { productId: number; quantity: number }[] = req.body.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('items must be a non-empty array', 400);
  }

  for (const item of items) {
    requirePositiveInt(item.productId, 'productId');
    requirePositiveInt(item.quantity, 'quantity');
  }

  const poolClient = await client.connect();
  try {
    await poolClient.query('BEGIN');

    const { rows: orderRows } = await poolClient.query(
      `INSERT INTO orders (user_id, status) VALUES ($1, 'active') RETURNING *`,
      [userId]
    );
    const order = orderRows[0];

    for (const item of items) {
      await poolClient.query(
        `INSERT INTO order_products (order_id, product_id, quantity) VALUES ($1, $2, $3)`,
        [order.id, item.productId, item.quantity]
      );
    }

    const { rows: completedRows } = await poolClient.query(
      `UPDATE orders SET status = 'complete' WHERE id = $1 RETURNING *`,
      [order.id]
    );

    await poolClient.query(`DELETE FROM cart_items WHERE user_id = $1`, [userId]);

    await poolClient.query('COMMIT');

    const completedOrder = completedRows[0];
    sendSuccess(
      res,
      { order: { id: completedOrder.id, userId: completedOrder.user_id, status: completedOrder.status } },
      'Checkout successful.',
      201
    );
  } catch (err) {
    await poolClient.query('ROLLBACK');
    throw new Error(`Checkout failed: ${err}`);
  } finally {
    poolClient.release();
  }
});

const cartRoutes = (app: Application) => {
  app.get('/cart',           verifyAuthToken, getCart);
  app.post('/cart',          verifyAuthToken, addItem);
  app.post('/cart/checkout', verifyAuthToken, checkout);
  app.put('/cart/:id',       verifyAuthToken, updateItem);
  app.delete('/cart/:id',    verifyAuthToken, removeItem);
  app.delete('/cart',        verifyAuthToken, clearCart);
};

export default cartRoutes;
