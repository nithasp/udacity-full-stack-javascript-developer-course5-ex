import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AddressEntry, AddressForm } from '../models/address.model';

const API_URL = 'http://localhost:3000/addresses';

@Injectable({ providedIn: 'root' })
export class AddressApiService {
  constructor(private http: HttpClient) {}

  getAll(): Observable<AddressEntry[]> {
    return this.http.get<AddressEntry[]>(API_URL);
  }

  getOne(id: number): Observable<AddressEntry> {
    return this.http.get<AddressEntry>(`${API_URL}/${id}`);
  }

  create(form: AddressForm): Observable<AddressEntry> {
    return this.http.post<AddressEntry>(API_URL, form);
  }

  update(id: number, form: Partial<AddressForm>): Observable<AddressEntry> {
    return this.http.put<AddressEntry>(`${API_URL}/${id}`, form);
  }

  delete(id: number): Observable<AddressEntry> {
    return this.http.delete<AddressEntry>(`${API_URL}/${id}`);
  }
}
