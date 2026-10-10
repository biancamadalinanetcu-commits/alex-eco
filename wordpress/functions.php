<?php
/**
 * Scalium theme setup.
 *
 * The templates are generated from the static site in /src by scripts/build.mjs,
 * so markup changes belong there, not in the PHP files.
 *
 * @package Scalium
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SCALIUM_VERSION', '1.0.0' );
define( 'SCALIUM_URI', get_template_directory_uri() );

/**
 * URL of the contact page, whatever the permalink setting is.
 */
function scalium_contact_url() {
	$page = get_page_by_path( 'contact' );
	return $page ? get_permalink( $page ) : home_url( '/contact/' );
}

/**
 * Value for the body data-page attribute, used by the language switcher.
 */
function scalium_page_key() {
	if ( is_front_page() ) {
		return 'home';
	}
	return is_page( 'contact' ) ? 'contact' : 'page';
}

add_action(
	'after_setup_theme',
	function () {
		add_theme_support( 'title-tag' );
		add_theme_support( 'html5', array( 'script', 'style', 'search-form', 'gallery', 'caption' ) );
		add_theme_support( 'responsive-embeds' );
	}
);

/**
 * Creates the "Contact" page once, so the contact buttons never lead to a 404.
 * Runs on theme activation and, as a fallback, once on the first request after install.
 */
function scalium_ensure_contact_page() {
	if ( get_option( 'scalium_contact_page_ready' ) ) {
		return;
	}
	if ( ! get_page_by_path( 'contact' ) ) {
		wp_insert_post(
			array(
				'post_title'   => 'Contact',
				'post_name'    => 'contact',
				'post_status'  => 'publish',
				'post_type'    => 'page',
				'post_content' => '',
			)
		);
	}
	update_option( 'scalium_contact_page_ready', 1 );
}
add_action(
	'after_switch_theme',
	function () {
		delete_option( 'scalium_contact_page_ready' );
		scalium_ensure_contact_page();
		flush_rewrite_rules();
	}
);
add_action( 'init', 'scalium_ensure_contact_page' );

add_action(
	'wp_enqueue_scripts',
	function () {
		wp_enqueue_style( 'scalium', SCALIUM_URI . '/assets/css/main.css', array(), SCALIUM_VERSION );
		wp_enqueue_script(
			'scalium',
			SCALIUM_URI . '/assets/js/main.js',
			array(),
			SCALIUM_VERSION,
			array(
				'strategy'  => 'defer',
				'in_footer' => false,
			)
		);
		// Runs at the end of <body>, before main.js, so the chosen language is applied before animations start.
		wp_enqueue_script( 'scalium-i18n', SCALIUM_URI . '/assets/js/i18n.js', array(), SCALIUM_VERSION, true );

		// The front page is fully hand-built: block editor styles are dead weight there.
		if ( is_front_page() ) {
			wp_dequeue_style( 'wp-block-library' );
			wp_dequeue_style( 'wp-block-library-theme' );
			wp_dequeue_style( 'classic-theme-styles' );
			wp_dequeue_style( 'global-styles' );
		}
	},
	20
);

// Fewer requests and bytes in <head>.
remove_action( 'wp_head', 'print_emoji_detection_script', 7 );
remove_action( 'wp_print_styles', 'print_emoji_styles' );
remove_action( 'wp_head', 'wp_generator' );
remove_action( 'wp_head', 'wlwmanifest_link' );
remove_action( 'wp_head', 'rsd_link' );
remove_action( 'wp_head', 'wp_shortlink_wp_head' );
add_filter( 'emoji_svg_url', '__return_false' );

add_filter(
	'document_title_separator',
	function () {
		return '|';
	}
);

add_filter(
	'pre_get_document_title',
	function ( $title ) {
		if ( is_front_page() ) {
			return 'Scalium | Meta Ads and Growth Marketing Agency';
		}
		if ( is_page( 'contact' ) ) {
			return 'Contact | Scalium';
		}
		return $title;
	}
);

// Basic SEO tags. Skipped automatically when an SEO plugin is active, so nothing is duplicated.
add_action(
	'wp_head',
	function () {
		if ( defined( 'WPSEO_VERSION' ) || defined( 'RANK_MATH_VERSION' ) || defined( 'AIOSEO_VERSION' ) || defined( 'SEOPRESS_VERSION' ) ) {
			return;
		}
		$desc = is_page( 'contact' )
			? 'Contact Scalium for more information and pricing on Meta Ads, marketing and growth marketing.'
			: 'Scalium helps eCommerce brands scale profitably with data-driven Meta Ads, AI optimization and growth marketing.';
		$image = SCALIUM_URI . '/assets/img/og-image.jpg';

		printf( '<meta name="description" content="%s">' . "\n", esc_attr( $desc ) );
		printf( '<meta property="og:type" content="website">' . "\n" );
		printf( '<meta property="og:site_name" content="Scalium">' . "\n" );
		printf( '<meta property="og:title" content="%s">' . "\n", esc_attr( wp_get_document_title() ) );
		printf( '<meta property="og:description" content="%s">' . "\n", esc_attr( $desc ) );
		printf( '<meta property="og:image" content="%s">' . "\n", esc_url( $image ) );
		printf( '<meta name="twitter:card" content="summary_large_image">' . "\n" );

		if ( is_front_page() ) {
			$data = array(
				'@context'      => 'https://schema.org',
				'@type'         => 'ProfessionalService',
				'name'          => 'Scalium',
				'url'           => home_url( '/' ),
				'description'   => 'Meta Ads, marketing and growth marketing agency for eCommerce brands.',
				'knowsLanguage' => array( 'en', 'ro' ),
				'serviceType'   => array( 'Meta Ads management', 'Marketing management', 'Growth marketing' ),
			);
			echo '<script type="application/ld+json">' . wp_json_encode( $data ) . '</script>' . "\n";
		}
	},
	1
);
