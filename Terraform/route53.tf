resource "aws_route53_zone" "expense_tracker" {
  name = var.domain_name


}

resource "aws_route53_record" "expense_tracker_record" {
  zone_id = aws_route53_zone.expense_tracker.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = "k8s-expenset-expensei-13b035839c-754574312.us-east-1.elb.amazonaws.com"
    zone_id                = "Z35SXDOTRQ7X7K"
    evaluate_target_health = true
  }
}