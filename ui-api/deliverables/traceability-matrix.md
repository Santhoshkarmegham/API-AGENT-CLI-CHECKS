# Traceability matrix

| UI Action | Captured Network Request | Discovered API | Generated Test Case | Execution Result |
| --- | --- | --- | --- | --- |
| Delete the temporary account created by the test | GET /delete_account | GET /delete_account (default) | authentication :: signup, login, and delete account from observed traffic | passed |
| Log out and log back in with the generated account | GET /logout | GET /logout (default) | Not generated | not_generated |
| Execute invalid login scenario | POST /login | POST /login (default) | authentication :: signup, login, and delete account from observed traffic \| authentication :: invalid login returns the observed error response | passed |
| Log out and log back in with the generated account | POST /login | POST /login (default) | authentication :: signup, login, and delete account from observed traffic \| authentication :: invalid login returns the observed error response | passed |
| Register a temporary account and validate the logged-in state | POST /signup | POST /signup (create_account) | authentication :: signup, login, and delete account from observed traffic | passed |
| Register a temporary account and validate the logged-in state | POST /signup | POST /signup (signup) | authentication :: signup, login, and delete account from observed traffic | passed |
| Add products to cart and update quantity where supported | GET /add_to_cart/1?quantity=2 | GET /add_to_cart/{productId} (default) | cart :: add and delete item through observed backend endpoints | passed |
| Remove a product from the cart | GET /delete_cart/2 | GET /delete_cart/{productId} (default) | cart :: add and delete item through observed backend endpoints | passed |
