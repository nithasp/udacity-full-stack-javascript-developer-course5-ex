import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BackendProduct } from '../utils/product-mappers';

@Injectable({
  providedIn: 'root'
})
export class ProductService {

  private readonly apiUrl = 'http://localhost:3000/products';

  constructor(private http: HttpClient) {}

  getProducts(): Observable<BackendProduct[]> {
    return this.http.get<BackendProduct[]>(this.apiUrl);
  }

  getProductById(id: string): Observable<BackendProduct> {
    return this.http.get<BackendProduct>(`${this.apiUrl}/${id}`);
  }
}
