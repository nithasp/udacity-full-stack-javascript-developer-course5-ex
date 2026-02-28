import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { map } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Product, ProductType } from '../models/product';
import { ProductService } from '../services/product.service';
import { mapBackendProduct } from '../utils/product-mappers';
import { CartService } from '../../../core/services/cart/cart.service';
import { NotificationService } from '../../../core/services/ui/notification.service';

@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss'
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  product: Product | undefined;
  selectedQuantity = 1;
  selectedType: ProductType | undefined;
  selectedImage = '';
  quantities = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  loading = true;

  // Tracks accumulated qty before the debounce fires
  private pendingQty = 0;

  private clickSubject = new Subject<void>();
  private sub!: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    public cartService: CartService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.productService.getProductById(id).pipe(
        map(mapBackendProduct)
      ).subscribe({
        next: (product) => {
          this.product = product;
          if (product) {
            this.selectedImage = product.image;
            this.selectedType = product.types[0];
          }
          this.loading = false;
        },
        error: () => {
          this.notificationService.error('Failed to load product details');
          this.loading = false;
        }
      });
    }

    this.sub = this.clickSubject.pipe(debounceTime(400)).subscribe(() => {
      if (!this.product) return;

      const addedQty = this.pendingQty;
      this.pendingQty = 0;

      // Sync accumulated local quantity to the backend
      this.cartService.syncToBackend(this.product, this.selectedType);

      this.notificationService.success(
        `${addedQty}x ${this.product.name} added to cart!`,
        'Added to Cart'
      );
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  selectImage(img: string): void {
    this.selectedImage = img;
  }

  selectType(type: ProductType): void {
    this.selectedType = type;
    this.selectedImage = type.image;
  }

  onQuantityChange(qty: number): void {
    this.selectedQuantity = qty;
  }

  addToCart(): void {
    if (!this.product) return;
    this.pendingQty += this.selectedQuantity;

    // Immediately reflect in local cart
    this.cartService.addToCartLocal(this.product, this.selectedQuantity, this.selectedType);

    // Reset the 400ms debounce window on every click
    this.clickSubject.next();
  }

  goBack(): void {
    this.router.navigate(['/products']);
  }

  get isAdding(): boolean {
    return this.cartService.isItemLoading(this.product?._id ?? '', this.selectedType?._id);
  }

  get currentPrice(): number {
    return this.selectedType?.price ?? this.product?.price ?? 0;
  }

  get ratingStars(): number[] {
    return Array(5).fill(0).map((_, i) => i + 1);
  }
}
