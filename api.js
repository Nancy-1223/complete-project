/* Data layer. Swap the URL for a real REST endpoint later; views never change. */
let request = null;

export function getProducts() {
  if (!request) {
    request = fetch("/data/products.json")
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load products (HTTP ${response.status})`);
        return response.json();
      })
      .catch((error) => {
        request = null; // allow a retry after a failure
        throw error;
      });
  }
  return request;
}

export async function getProduct(id) {
  const products = await getProducts();
  return products.find((product) => product.id === id) || null;
}
