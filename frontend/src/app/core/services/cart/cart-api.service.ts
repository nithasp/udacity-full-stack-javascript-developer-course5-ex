import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProductType } from '../../../features/products/models/product';

const API_URL = 'http://localhost:3000/cart';

export interface CartApiItem {
  id: number;
  userId: number;
  productId: number;
  quantity: number;
  typeId: string;
  selectedType: ProductType | null;
  shopId: string | null;
  shopName: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined product fields (present when fetching cart)
  productName?: string;
  productPrice?: number;
  productCategory?: string;
  productImage?: string;
  productDescription?: string;
  productPreviewImg?: string[];
  productTypes?: ProductType[];
  productReviews?: unknown[];
  productOverallRating?: number;
  productStock?: number;
  productIsActive?: boolean;
  productShopId?: string | null;
  productShopName?: string | null;
}

export interface AddCartItemPayload {
  productId: number;
  quantity: number;
  typeId?: string | null;
  selectedType?: ProductType | null;
  shopId?: string | null;
  shopName?: string | null;
}

export interface CheckoutItem {
  productId: number;
  quantity: number;
}

export interface CheckoutResponse {
  order: { id: number; userId: number; status: string };
}

@Injectable({ providedIn: 'root' })
export class CartApiService {
  constructor(private http: HttpClient) {}

  getCart(): Observable<CartApiItem[]> {
    return this.http.get<CartApiItem[]>(API_URL);
  }

  addItem(payload: AddCartItemPayload): Observable<CartApiItem> {
    return this.http.post<CartApiItem>(API_URL, payload);
  }

  updateItem(cartItemId: number, quantity: number): Observable<CartApiItem> {
    return this.http.put<CartApiItem>(`${API_URL}/${cartItemId}`, { quantity });
  }

  removeItem(cartItemId: number): Observable<CartApiItem> {
    return this.http.delete<CartApiItem>(`${API_URL}/${cartItemId}`);
  }

  clearCart(): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(API_URL);
  }

  checkout(items: CheckoutItem[]): Observable<CheckoutResponse> {
    return this.http.post<CheckoutResponse>(`${API_URL}/checkout`, { items });
  }
}
