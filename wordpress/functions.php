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

define( 'SCALIUM_VERSION', '1.1.0' );
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

/**
 * Contact details and social links: Appearance > Customize > Scalium contact.
 * Empty fields fall back to the defaults in config.php (generated from src/config.json).
 *
 * @param string $key email, whatsapp, whatsapp_display, instagram or tiktok.
 */
function scalium_setting( $key ) {
	static $defaults = null;
	if ( null === $defaults ) {
		$defaults = require __DIR__ . '/config.php';
	}
	$value = trim( (string) get_theme_mod( 'scalium_' . $key, '' ) );
	return '' !== $value ? $value : ( isset( $defaults[ $key ] ) ? $defaults[ $key ] : '' );
}

add_action(
	'customize_register',
	function ( $wp_customize ) {
		$wp_customize->add_section(
			'scalium_contact',
			array(
				'title'       => 'Scalium contact',
				'description' => 'Where contact requests are sent, the WhatsApp number and the social profiles. Leave a field empty to use the default.',
				'priority'    => 30,
			)
		);
		$fields = array(
			'email'            => array( 'Email that receives contact requests', 'sanitize_email', 'email' ),
			'whatsapp'         => array( 'WhatsApp number, digits only with country code (e.g. 40792535738)', 'scalium_sanitize_digits', 'text' ),
			'whatsapp_display' => array( 'WhatsApp number as shown on the page', 'sanitize_text_field', 'text' ),
			'instagram'        => array( 'Instagram profile URL', 'esc_url_raw', 'url' ),
			'tiktok'           => array( 'TikTok profile URL', 'esc_url_raw', 'url' ),
		);
		foreach ( $fields as $key => $field ) {
			$wp_customize->add_setting(
				'scalium_' . $key,
				array(
					'default'           => '',
					'sanitize_callback' => $field[1],
				)
			);
			$wp_customize->add_control(
				'scalium_' . $key,
				array(
					'label'       => $field[0],
					'section'     => 'scalium_contact',
					'type'        => $field[2],
					'input_attrs' => array( 'placeholder' => scalium_setting( $key ) ),
				)
			);
		}
	}
);

/**
 * Result of a contact form sent without JavaScript (the handler redirects back with ?sent=1 or ?sent=0).
 *
 * @return string 'sent', 'failed' or ''.
 */
function scalium_form_result() {
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- display-only flag set by our own redirect.
	$sent = isset( $_GET['sent'] ) ? sanitize_key( wp_unslash( $_GET['sent'] ) ) : '';
	if ( '1' === $sent ) {
		return 'sent';
	}
	return '0' === $sent ? 'failed' : '';
}

function scalium_sanitize_digits( $value ) {
	return preg_replace( '/\D+/', '', (string) $value );
}

/**
 * Contact requests are also stored in wp-admin (Contact requests), so a request is never lost
 * if the host cannot send email.
 */
add_action(
	'init',
	function () {
		register_post_type(
			'scalium_request',
			array(
				'labels'          => array(
					'name'          => 'Contact requests',
					'singular_name' => 'Contact request',
					'menu_name'     => 'Contact requests',
				),
				'public'          => false,
				'show_ui'         => true,
				'show_in_menu'    => true,
				'menu_position'   => 25,
				'menu_icon'       => 'dashicons-email-alt',
				'supports'        => array( 'title', 'editor' ),
				'capability_type' => 'post',
				'capabilities'    => array( 'create_posts' => 'do_not_allow' ),
				'map_meta_cap'    => true,
			)
		);
	}
);

/**
 * Handles the contact form (admin-post.php?action=scalium_contact).
 * The page sends it in the background and expects JSON; without JavaScript the visitor is
 * redirected back to the contact page.
 */
function scalium_handle_contact() {
	$wants_json = isset( $_SERVER['HTTP_ACCEPT'] ) && false !== strpos( sanitize_text_field( wp_unslash( $_SERVER['HTTP_ACCEPT'] ) ), 'application/json' );
	$respond    = function ( $ok, $status = 200 ) use ( $wants_json ) {
		if ( $wants_json ) {
			wp_send_json( array( 'success' => $ok ), $status );
		}
		wp_safe_redirect( add_query_arg( 'sent', $ok ? '1' : '0', scalium_contact_url() ) . '#contact-form' );
		exit;
	};

	// phpcs:disable WordPress.Security.NonceVerification.Missing -- public form; cached pages make nonces unreliable, so it relies on the honeypot and a rate limit.
	// Bots fill the hidden field: let them think it worked.
	if ( ! empty( $_POST['_honey'] ) ) {
		$respond( true );
	}

	// At most 5 requests per 10 minutes from the same address.
	$ip    = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
	$limit = 'scalium_rl_' . md5( $ip );
	$count = (int) get_transient( $limit );
	if ( $count >= 5 ) {
		$respond( false, 429 );
	}
	set_transient( $limit, $count + 1, 10 * MINUTE_IN_SECONDS );

	$field = function ( $key, $multiline = false ) {
		if ( ! isset( $_POST[ $key ] ) ) {
			return '';
		}
		$value = wp_unslash( $_POST[ $key ] );
		if ( is_array( $value ) ) {
			$value = implode( ', ', $value );
		}
		$value = $multiline ? sanitize_textarea_field( $value ) : sanitize_text_field( $value );
		return mb_substr( $value, 0, $multiline ? 3000 : 200 );
	};
	$request = array(
		'Service'  => $field( 'service' ),
		'Name'     => $field( 'name' ),
		'Email'    => sanitize_email( $field( 'email' ) ),
		'Phone'    => $field( 'phone' ),
		'Message'  => $field( 'message', true ),
		'Language' => $field( 'language' ),
	);
	// phpcs:enable

	if ( '' === $request['Name'] || ! is_email( $request['Email'] ) || '' === $request['Phone'] ) {
		$respond( false, 400 );
	}

	$lines = array();
	foreach ( $request as $label => $value ) {
		$lines[] = $label . ': ' . ( '' !== $value ? $value : '-' );
	}
	$text = implode( "\n", $lines );

	wp_insert_post(
		array(
			'post_type'    => 'scalium_request',
			'post_status'  => 'private',
			'post_title'   => $request['Name'] . ( $request['Service'] ? ' - ' . $request['Service'] : '' ),
			'post_content' => esc_html( $text ),
		)
	);

	wp_mail(
		scalium_setting( 'email' ),
		'New request from the Scalium website: ' . $request['Name'],
		$text . "\n\n" . 'Sent from ' . scalium_contact_url(),
		array( 'Reply-To: ' . str_replace( array( ',', ';', '"', '<', '>' ), '', $request['Name'] ) . ' <' . $request['Email'] . '>' )
	);

	// The request is saved in wp-admin even if the host cannot send email.
	$respond( true );
}
add_action( 'admin_post_nopriv_scalium_contact', 'scalium_handle_contact' );
add_action( 'admin_post_scalium_contact', 'scalium_handle_contact' );

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

// Language versions: the theme serves Romanian at ?lang=ro (the text switches in the browser).
add_action(
	'wp_head',
	function () {
		if ( ! is_front_page() && ! is_page( 'contact' ) ) {
			return;
		}
		$base = is_front_page() ? home_url( '/' ) : get_permalink();
		printf( '<link rel="alternate" hreflang="en" href="%s">' . "\n", esc_url( $base ) );
		printf( '<link rel="alternate" hreflang="ro" href="%s">' . "\n", esc_url( add_query_arg( 'lang', 'ro', $base ) ) );
		printf( '<link rel="alternate" hreflang="x-default" href="%s">' . "\n", esc_url( $base ) );
	},
	2
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
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- language flag in the address, display only.
		$is_ro = isset( $_GET['lang'] ) && 'ro' === sanitize_key( wp_unslash( $_GET['lang'] ) );
		$base  = is_front_page() ? home_url( '/' ) : get_permalink();
		$self  = $is_ro ? add_query_arg( 'lang', 'ro', $base ) : $base;
		if ( is_front_page() ) {
			// WordPress prints a canonical link for pages and posts itself, but not for the front page.
			printf( '<link rel="canonical" href="%s">' . "\n", esc_url( $self ) );
		}

		printf( '<meta name="description" content="%s">' . "\n", esc_attr( $desc ) );
		printf( '<meta property="og:type" content="website">' . "\n" );
		printf( '<meta property="og:site_name" content="Scalium">' . "\n" );
		printf( '<meta property="og:title" content="%s">' . "\n", esc_attr( wp_get_document_title() ) );
		printf( '<meta property="og:description" content="%s">' . "\n", esc_attr( $desc ) );
		printf( '<meta property="og:image" content="%s">' . "\n", esc_url( $image ) );
		printf( '<meta property="og:url" content="%s">' . "\n", esc_url( $self ) );
		printf( '<meta property="og:locale" content="%s">' . "\n", $is_ro ? 'ro_RO' : 'en_US' );
		printf( '<meta name="twitter:card" content="summary_large_image">' . "\n" );

		if ( is_front_page() ) {
			$phone = '+' . scalium_setting( 'whatsapp' );
			$data  = array(
				'@context'      => 'https://schema.org',
				'@type'         => 'ProfessionalService',
				'@id'           => home_url( '/#business' ),
				'name'          => 'Scalium',
				'url'           => home_url( '/' ),
				'logo'          => SCALIUM_URI . '/assets/img/apple-touch-icon.png',
				'image'         => $image,
				'description'   => 'Meta Ads, marketing and growth marketing agency for eCommerce brands.',
				'email'         => scalium_setting( 'email' ),
				'telephone'     => $phone,
				'knowsLanguage' => array( 'en', 'ro' ),
				'areaServed'    => array( 'RO', 'Worldwide' ),
				'sameAs'        => array( scalium_setting( 'instagram' ), scalium_setting( 'tiktok' ) ),
				'contactPoint'  => array(
					'@type'             => 'ContactPoint',
					'contactType'       => 'sales',
					'email'             => scalium_setting( 'email' ),
					'telephone'         => $phone,
					'availableLanguage' => array( 'English', 'Romanian' ),
				),
				'serviceType'   => array( 'Meta Ads management', 'Marketing management', 'Growth marketing' ),
			);
			echo '<script type="application/ld+json">' . wp_json_encode( $data ) . '</script>' . "\n";
		}
	},
	1
);
