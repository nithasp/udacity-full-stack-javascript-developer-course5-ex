import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Product, ProductType } from '../../models/product';
import { CartService } from '../../../../core/services/cart.service';
import { NotificationService } from '../../../../core/services/notification.service';

@Component({
  selector: 'app-product-card',
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss'
})
export class ProductCardComponent implements OnInit, OnDestroy {
  @Input() product!: Product;

  // Tracks how many units were added locally before the debounce fires
  private pendingQty = 0;
  private pendingType: ProductType | undefined;

  private clickSubject = new Subject<void>();
  private sub!: Subscription;

  constructor(
    public cartService: CartService,
    private notificationService: NotificationService,
  ) {}

  ngOnInit(): void {
    this.sub = this.clickSubject.pipe(debounceTime(400)).subscribe(() => {
      const addedQty = this.pendingQty;
      this.pendingQty = 0;

      // Sync the accumulated local quantity to the backend
      this.cartService.syncToBackend(this.product, this.pendingType);

      this.notificationService.success(
        `${addedQty}x ${this.product.name} added to cart!`,
        'Added to Cart'
      );
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  onAddToCart(): void {
    const defaultType = this.product.types[0];
    this.pendingType = defaultType;
    this.pendingQty += 1;

    // Immediately reflect in local cart
    this.cartService.addToCartLocal(this.product, 1, defaultType);

    // Reset the 400ms debounce window on every click
    this.clickSubject.next();
  }

  get isAdding(): boolean {
    return this.cartService.isItemLoading(this.product._id, this.product.types[0]?._id);
  }

  get ratingStars(): number[] {
    return Array(5).fill(0).map((_, i) => i + 1);
  }
}
