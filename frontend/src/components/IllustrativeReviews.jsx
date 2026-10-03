export default function IllustrativeReviews({ reviews = [] }) {
  if (!reviews.length) return null;
  return <section className="illustrative-reviews" aria-labelledby="illustrative-reviews-title">
    <h3 id="illustrative-reviews-title">Comentários ilustrativos</h3>
    <p className="reviews-disclosure">Exemplos para apresentar o site. Não são relatos de hóspedes nem avaliações do Airbnb.</p>
    <div className="illustrative-reviews-grid">
      {reviews.map((review, index) => <article key={index}>
        <div className="review-heading"><strong>{review.name}</strong><span className="review-example-label">Ilustrativo</span></div>
        <span className="review-stars" aria-label={`${review.rating} de 5 estrelas`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
        <p>{review.text}</p>
      </article>)}
    </div>
  </section>;
}
