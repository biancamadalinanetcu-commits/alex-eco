<?php
/**
 * Fallback template for any page or post that has no dedicated template.
 *
 * @package Scalium
 */

get_header();
?>
<main id="main" class="contact">
	<section class="contact__hero">
		<div class="container contact__inner">
			<?php if ( have_posts() ) : ?>
				<?php while ( have_posts() ) : the_post(); ?>
					<h1 class="contact__title"><?php the_title(); ?></h1>
					<div class="contact__slot"><?php the_content(); ?></div>
				<?php endwhile; ?>
			<?php else : ?>
				<h1 class="contact__title"><?php esc_html_e( 'Page not found', 'scalium' ); ?></h1>
				<p class="contact__lead"><a class="link" href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Back to home', 'scalium' ); ?></a></p>
			<?php endif; ?>
		</div>
	</section>
</main>
<?php
get_footer();
