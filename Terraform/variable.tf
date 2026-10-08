variable "aws_region" {
  description = "The AWS region to deploy resources in"
  type        = string

}

variable "availability_zones" {
  description = "List of availability zones to use for subnets"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}


variable "vpc_cdir_block" {
  description = "Cdir block for VPC"
  type        = string
}

variable "public_subnet_1_cdir_block" {
  description = "cidr_block for public subnet 1"
  type        = string

}

variable "public_subnet_2_cdir_block" {

  description = "cidr_block for public subnet 2"
  type        = string
}

variable "private_subnet_1_cdir_block" {
  description = "cidr_block for private subnet 1"
  type        = string
}

variable "private_subnet_2_cdir_block" {
  description = "cidr_block for private subnet 2"
  type        = string
}

variable "route_table_cdir_block" {
  description = "cdir_block for route table"
  type        = string
}

variable "private_route_table_cdir_block" {
  description = "private route table cdir block for nat"
  type        = string

}

variable "domain_name" {
  description = "The domain name for the Expense Tracker Application"
  type        = string
}