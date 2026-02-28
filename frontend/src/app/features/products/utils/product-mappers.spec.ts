import { mapBackendProduct } from './product-mappers';

describe('mapBackendProduct', () => {
  it('should map backend product fields correctly', () => {
    const backendProduct = {
      id: 1,
      name: 'Product 1',
      category: 'Electronics',
      price: 99.99,
      image: 'https://example.com/img1.jpg',
      description: 'First product',
      previewImg: [],
      types: [],
      reviews: [],
      overallRating: 4.5
    };

    const product = mapBackendProduct(backendProduct);

    expect(product._id).toBe('1');
    expect(product.name).toBe('Product 1');
    expect(product.category).toBe('Electronics');
    expect(product.price).toBe(99.99);
    expect(product.image).toBe('https://example.com/img1.jpg');
    expect(product.description).toBe('First product');
    expect(product.overallRating).toBe(4.5);
  });

  it('should use defaults for optional fields', () => {
    const backendProduct = {
      id: 2,
      name: 'Minimal Product',
      price: 49.99
    };

    const product = mapBackendProduct(backendProduct);

    expect(product._id).toBe('2');
    expect(product.category).toBe('');
    expect(product.image).toBe('');
    expect(product.description).toBe('');
    expect(product.previewImg).toEqual([]);
    expect(product.types).toEqual([]);
    expect(product.reviews).toEqual([]);
    expect(product.overallRating).toBe(0);
  });
});
