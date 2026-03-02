import { Application, Request, Response } from 'express';
import { AddressStore } from '../models/address';
import { verifyAuthToken } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError, sendSuccess } from '../utils/response';
import { parseId, requireString } from '../utils/validate';

const addressStore = new AddressStore();

const VALID_LABELS = ['home', 'work', 'other'] as const;

function parseLabel(val: unknown): 'home' | 'work' | 'other' {
  if (!val || !VALID_LABELS.includes(val as 'home' | 'work' | 'other')) {
    return 'home';
  }
  return val as 'home' | 'work' | 'other';
}

// GET /addresses — get all addresses for the authenticated user
const getAddresses = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  sendSuccess(res, await addressStore.getByUser(userId), 'Addresses fetched.');
});

// GET /addresses/:id — get a single address (must belong to user)
const getAddress = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const id = parseId(req.params.id, 'address id');

  const address = await addressStore.show(id, userId);
  if (!address) throw new AppError(`Address ${id} not found`, 404);

  sendSuccess(res, address, 'Address fetched.');
});

// POST /addresses — create a new address for the authenticated user
const createAddress = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const fullName  = requireString(req.body.fullName, 'fullName');
  const address   = requireString(req.body.address,  'address');
  const city      = requireString(req.body.city,     'city');
  const phone     = typeof req.body.phone === 'string' && req.body.phone.trim()
    ? req.body.phone.trim()
    : undefined;
  const label     = parseLabel(req.body.label);
  const isDefault = req.body.isDefault === true || req.body.isDefault === 'true';

  const created = await addressStore.create(userId, { fullName, phone, address, city, label, isDefault });
  sendSuccess(res, created, 'Address created.', 201);
});

// PUT /addresses/:id — update an address (must belong to user)
const updateAddress = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const id = parseId(req.params.id, 'address id');

  const form: Record<string, unknown> = {};
  if (req.body.fullName !== undefined) form.fullName = requireString(req.body.fullName, 'fullName');
  if (req.body.address  !== undefined) form.address  = requireString(req.body.address,  'address');
  if (req.body.city     !== undefined) form.city     = requireString(req.body.city,     'city');
  if (req.body.phone    !== undefined) {
    form.phone = typeof req.body.phone === 'string' && req.body.phone.trim()
      ? req.body.phone.trim()
      : null;
  }
  if (req.body.label     !== undefined) form.label     = parseLabel(req.body.label);
  if (req.body.isDefault !== undefined) form.isDefault = req.body.isDefault === true || req.body.isDefault === 'true';

  const updated = await addressStore.update(id, userId, form);
  if (!updated) throw new AppError(`Address ${id} not found`, 404);

  sendSuccess(res, updated, 'Address updated.');
});

// DELETE /addresses/:id — delete an address (must belong to user)
const deleteAddress = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const id = parseId(req.params.id, 'address id');

  const deleted = await addressStore.delete(id, userId);
  if (!deleted) throw new AppError(`Address ${id} not found`, 404);

  sendSuccess(res, deleted, 'Address deleted.');
});

const addressRoutes = (app: Application) => {
  app.get('/addresses',        verifyAuthToken, getAddresses);
  app.get('/addresses/:id',    verifyAuthToken, getAddress);
  app.post('/addresses',       verifyAuthToken, createAddress);
  app.put('/addresses/:id',    verifyAuthToken, updateAddress);
  app.delete('/addresses/:id', verifyAuthToken, deleteAddress);
};

export default addressRoutes;
