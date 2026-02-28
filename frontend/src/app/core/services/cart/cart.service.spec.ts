import { TestBed } from '@angular/core/testing';
import { CartService } from './cart.service';
import { Product, ProductType } from '../../../features/products/models/product';

describe('CartService', () => {
  let service: CartService;

  const mockType: ProductType = {
    _id: 'type1',
    productId: 1001,
    color: 'Black',
    quantity: 50,
    price: 79.99,
    stock: 50,
    image: 'https://example.com/img.jpg'
  };

  const mockProduct: Product = {
    _id: 'prod1',
    name: 'Test Product',
    category: 'Electronics',
    price: 79.99,
    image: 'https://example.com/img.jpg',
    description: 'A test product',
    previewImg: ['https://example.com/img.jpg'],
    types: [mockType],
    reviews: [],
    overallRating: 4.5
  };

  const mockProduct2: Product = {
    ...mockProduct,
    _id: 'prod2',
    name: 'Test Product 2',
    price: 49.99
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CartService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with an empty cart', () => {
    expect(service.getItems().length).toBe(0);
    expect(service.getTotal()).toBe(0);
    expect(service.getCartCount()).toBe(0);
  });

  it('should add a product to the cart', () => {
    service.addToCart(mockProduct, 2, mockType);
    const items = service.getItems();
    expect(items.length).toBe(1);
    expect(items[0].product._id).toBe('prod1');
    expect(items[0].quantity).toBe(2);
  });

  it('should increment quantity when adding the same product', () => {
    service.addToCart(mockProduct, 1, mockType);
    service.addToCart(mockProduct, 3, mockType);
    const items = service.getItems();
    expect(items.length).toBe(1);
    expect(items[0].quantity).toBe(4);
  });

  it('should add different products as separate items', () => {
    service.addToCart(mockProduct, 1, mockType);
    service.addToCart(mockProduct2, 2);
    const items = service.getItems();
    expect(items.length).toBe(2);
  });

  it('should calculate total correctly', () => {
    service.addToCart(mockProduct, 2, mockType);
    expect(service.getTotal()).toBeCloseTo(159.98, 2);
  });

  it('should calculate total for multiple products', () => {
    service.addToCart(mockProduct, 1, mockType);
    service.addToCart(mockProduct2, 2);
    expect(service.getTotal()).toBeCloseTo(79.99 + 2 * 49.99, 2);
  });

  it('should return correct cart count', () => {
    service.addToCart(mockProduct, 3, mockType);
    service.addToCart(mockProduct2, 2);
    expect(service.getCartCount()).toBe(5);
  });

  it('should remove a product from the cart', () => {
    service.addToCart(mockProduct, 1, mockType);
    service.addToCart(mockProduct2, 1);
    service.removeFromCart('prod1', 'type1');
    const items = service.getItems();
    expect(items.length).toBe(1);
    expect(items[0].product._id).toBe('prod2');
  });

  it('should update quantity of a product', () => {
    service.addToCart(mockProduct, 1, mockType);
    service.updateQuantity('prod1', 5, 'type1');
    expect(service.getItems()[0].quantity).toBe(5);
  });

  it('should not allow quantity below 1', () => {
    service.addToCart(mockProduct, 3, mockType);
    service.updateQuantity('prod1', 0, 'type1');
    expect(service.getItems()[0].quantity).toBe(1);
  });

  it('should clear the cart', () => {
    service.addToCart(mockProduct, 1, mockType);
    service.addToCart(mockProduct2, 2);
    service.clearCart();
    expect(service.getItems().length).toBe(0);
    expect(service.getTotal()).toBe(0);
    expect(service.getCartCount()).toBe(0);
  });

  it('should emit cart changes via observable', (done) => {
    let emitCount = 0;
    service.cart$.subscribe(items => {
      emitCount++;
      if (emitCount === 2) {
        expect(items.length).toBe(1);
        done();
      }
    });
    service.addToCart(mockProduct, 1, mockType);
  });
});
