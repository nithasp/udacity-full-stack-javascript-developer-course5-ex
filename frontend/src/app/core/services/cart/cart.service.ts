import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { CartItem, Product, ProductType, Review } from '../../../features/products/models/product';
import { CartApiService, CartApiItem } from './cart-api.service';

interface QuantityUpdate {
  cartItemId: number;
  quantity: number;
  itemKey: string;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private cartItems: CartItem[] = [];
  private cartSubject = new BehaviorSubject<CartItem[]>([]);
  cart$ = this.cartSubject.asObservable();

  // Global initial-load state (true while the first getCart() is in flight)
  private cartLoadingSubject = new BehaviorSubject<boolean>(false);
  isCartLoading$ = this.cartLoadingSubject.asObservable();

  // Per-item loading state: key = `${productId}_${typeId ?? 'default'}`
  private loadingKeys = new Set<string>();
  private loadingSubject = new BehaviorSubject<Set<string>>(new Set());
  loading$ = this.loadingSubject.asObservable();

  // Debounced quantity-update pipeline
  private quantityUpdate$ = new Subject<QuantityUpdate>();

  constructor(private cartApi: CartApiService) {
    this.quantityUpdate$
      .pipe(
        debounceTime(400),
        switchMap(({ cartItemId, quantity, itemKey }) => {
          this.setLoading(itemKey, true);
          return this.cartApi.updateItem(cartItemId, quantity).pipe(
            // Ensure loading is cleared even on error via finalize-like pattern
            // (handled in subscribe below)
          );
        })
      )
      .subscribe({
        next: (updated) => {
          const item = this.cartItems.find(i => i.cartItemId === updated.id);
          if (item) {
            item.quantity = updated.quantity;
            this.cartSubject.next([...this.cartItems]);
          }
          this.clearLoadingByCartItemId(updated.id);
        },
        error: () => {
          // On error clear all loading flags and re-emit state
          this.loadingKeys.clear();
          this.loadingSubject.next(new Set());
        },
      });
  }

  // ── Loading helpers ────────────────────────────────────────────────────────

  private setLoading(key: string, loading: boolean): void {
    if (loading) {
      this.loadingKeys.add(key);
    } else {
      this.loadingKeys.delete(key);
    }
    this.loadingSubject.next(new Set(this.loadingKeys));
  }

  private clearLoadingByCartItemId(cartItemId: number): void {
    const item = this.cartItems.find(i => i.cartItemId === cartItemId);
    if (item) {
      this.setLoading(this.makeKey(item.product._id, item.selectedType?._id), false);
    }
  }

  isItemLoading(productId: string, typeId?: string): boolean {
    return this.loadingKeys.has(this.makeKey(productId, typeId));
  }

  private makeKey(productId: string, typeId?: string): string {
    return `${productId}_${typeId ?? 'default'}`;
  }

  // ── Load cart from backend (call on cart page init) ─────────────────────

  /** Fetch cart from backend. Sets isCartLoading$ while in flight. */
  fetchCart(): void {
    this.cartLoadingSubject.next(true);
    this.cartApi.getCart().subscribe({
      next: (apiItems) => {
        this.cartItems = apiItems.map(api => this.apiItemToCartItem(api));
        this.cartSubject.next([...this.cartItems]);
        this.cartLoadingSubject.next(false);
      },
      error: () => {
        this.cartLoadingSubject.next(false);
      },
    });
  }

  /** Clear local cart state (called on logout). */
  resetCart(): void {
    this.cartItems = [];
    this.cartSubject.next([]);
    this.loadingKeys.clear();
    this.loadingSubject.next(new Set());
    this.cartLoadingSubject.next(false);
  }

  /** Convert a raw CartApiItem (with joined product fields) into a frontend CartItem. */
  private apiItemToCartItem(api: CartApiItem): CartItem {
    const product: Product = {
      _id: String(api.productId),
      name: api.productName ?? '',
      category: api.productCategory ?? '',
      price: api.productPrice ?? 0,
      image: api.productImage ?? '',
      description: api.productDescription ?? '',
      previewImg: api.productPreviewImg ?? [],
      types: api.productTypes ?? [],
      reviews: (api.productReviews ?? []) as Review[],
      overallRating: api.productOverallRating ?? 0,
      stock: api.productStock,
      isActive: api.productIsActive,
      shopId: api.productShopId ?? undefined,
      shopName: api.productShopName ?? undefined,
    };

    return {
      cartItemId: api.id,
      product,
      quantity: api.quantity,
      selectedType: api.selectedType ?? undefined,
      shopId: api.shopId ?? product.shopId ?? '',
      shopName: api.shopName ?? product.shopName ?? '',
    };
  }

  // ── Cart CRUD ──────────────────────────────────────────────────────────────

  /**
   * Update local cart state immediately without calling the backend.
   * Used for instant UI feedback on every button click before the debounce fires.
   */
  addToCartLocal(product: Product, quantity: number, selectedType?: ProductType): void {
    const existingIndex = this.cartItems.findIndex(
      item => item.product._id === product._id &&
              item.selectedType?._id === selectedType?._id
    );
    if (existingIndex > -1) {
      this.cartItems[existingIndex].quantity += quantity;
    } else {
      this.cartItems.push({
        product,
        quantity,
        selectedType,
        shopId: product.shopId ?? '',
        shopName: product.shopName ?? '',
      });
    }
    this.cartSubject.next([...this.cartItems]);
  }

  /**
   * Sync the current local quantity for a product/type to the backend.
   * Called after the debounce fires. Reads the current local quantity so
   * all accumulated clicks are sent in one request.
   *
   * - If the item already has a cartItemId → PUT (update quantity)
   * - If the item is new → POST (create)
   */
  syncToBackend(product: Product, selectedType?: ProductType): void {
    const key = this.makeKey(product._id, selectedType?._id);
    const item = this.cartItems.find(
      i => i.product._id === product._id &&
           i.selectedType?._id === selectedType?._id
    );
    if (!item) return;

    this.setLoading(key, true);

    if (item.cartItemId) {
      this.cartApi.updateItem(item.cartItemId, item.quantity).subscribe({
        next: (updated) => {
          item.quantity = updated.quantity;
          this.cartSubject.next([...this.cartItems]);
          this.setLoading(key, false);
        },
        error: () => this.setLoading(key, false),
      });
    } else {
      this.cartApi.addItem({
        productId: Number(product._id),
        quantity: item.quantity,
        typeId: selectedType?._id ?? null,
        selectedType: selectedType ?? null,
        shopId: product.shopId ?? null,
        shopName: product.shopName ?? null,
      }).subscribe({
        next: (apiItem) => {
          item.cartItemId = apiItem.id;
          item.quantity = apiItem.quantity;
          this.cartSubject.next([...this.cartItems]);
          this.setLoading(key, false);
        },
        error: () => {
          // Revert local item on failure
          this.cartItems = this.cartItems.filter(
            i => !(i.product._id === product._id &&
                   i.selectedType?._id === selectedType?._id)
          );
          this.cartSubject.next([...this.cartItems]);
          this.setLoading(key, false);
        },
      });
    }
  }

  addToCart(product: Product, quantity: number, selectedType?: ProductType): void {
    const key = this.makeKey(product._id, selectedType?._id);
    const existingIndex = this.cartItems.findIndex(
      item => item.product._id === product._id &&
              item.selectedType?._id === selectedType?._id
    );

    // Optimistic local update
    if (existingIndex > -1) {
      this.cartItems[existingIndex].quantity += quantity;
    } else {
      this.cartItems.push({
        product,
        quantity,
        selectedType,
        shopId: product.shopId ?? '',
        shopName: product.shopName ?? '',
      });
    }
    this.cartSubject.next([...this.cartItems]);

    this.setLoading(key, true);
    this.cartApi.addItem({
      productId: Number(product._id),
      quantity,
      typeId: selectedType?._id ?? null,
      selectedType: selectedType ?? null,
      shopId: product.shopId ?? null,
      shopName: product.shopName ?? null,
    }).subscribe({
      next: (apiItem) => {
        const item = this.cartItems.find(
          i => i.product._id === product._id &&
               i.selectedType?._id === selectedType?._id
        );
        if (item) {
          item.cartItemId = apiItem.id;
          item.quantity = apiItem.quantity;
          this.cartSubject.next([...this.cartItems]);
        }
        this.setLoading(key, false);
      },
      error: () => {
        // Revert optimistic update
        if (existingIndex > -1) {
          this.cartItems[existingIndex].quantity -= quantity;
        } else {
          this.cartItems = this.cartItems.filter(
            i => !(i.product._id === product._id &&
                   i.selectedType?._id === selectedType?._id)
          );
        }
        this.cartSubject.next([...this.cartItems]);
        this.setLoading(key, false);
      },
    });
  }

  removeFromCart(productId: string, typeId?: string): void {
    const key = this.makeKey(productId, typeId);
    const item = this.cartItems.find(
      i => i.product._id === productId && i.selectedType?._id === typeId
    );
    if (!item) return;

    this.setLoading(key, true);

    if (item.cartItemId) {
      this.cartApi.removeItem(item.cartItemId).subscribe({
        next: () => {
          this.cartItems = this.cartItems.filter(
            i => !(i.product._id === productId && i.selectedType?._id === typeId)
          );
          this.cartSubject.next([...this.cartItems]);
          this.setLoading(key, false);
        },
        error: () => this.setLoading(key, false),
      });
    } else {
      // Item not yet persisted (edge case)
      this.cartItems = this.cartItems.filter(
        i => !(i.product._id === productId && i.selectedType?._id === typeId)
      );
      this.cartSubject.next([...this.cartItems]);
      this.setLoading(key, false);
    }
  }

  /**
   * Update quantity for a cart item.
   * The local state is updated immediately; the API call is debounced 400ms.
   */
  updateQuantity(productId: string, quantity: number, typeId?: string): void {
    const key = this.makeKey(productId, typeId);
    const item = this.cartItems.find(
      i => i.product._id === productId && i.selectedType?._id === typeId
    );
    if (!item) return;

    item.quantity = Math.max(1, quantity);
    this.cartSubject.next([...this.cartItems]);

    if (item.cartItemId) {
      this.quantityUpdate$.next({ cartItemId: item.cartItemId, quantity: item.quantity, itemKey: key });
    }
  }

  clearCart(): void {
    this.cartApi.clearCart().subscribe({
      next: () => {
        this.cartItems = [];
        this.cartSubject.next([]);
      },
    });
  }

  /** Clear local cart without calling the API (use after checkout completes). */
  clearLocalCart(): void {
    this.cartItems = [];
    this.cartSubject.next([]);
  }

  getTotal(): number {
    return this.cartItems.reduce((total, item) => {
      const price = item.selectedType?.price ?? item.product.price;
      return total + (price * item.quantity);
    }, 0);
  }

  getCartCount(): number {
    return this.cartItems.reduce((count, item) => count + item.quantity, 0);
  }

  getItems(): CartItem[] {
    return [...this.cartItems];
  }
}
