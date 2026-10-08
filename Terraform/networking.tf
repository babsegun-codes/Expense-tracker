resource "aws_vpc" "expense_tracker_vpc" {
  cidr_block           = var.vpc_cdir_block
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = {
    Name       = "expense_tracker_vpc"
    managed_by = "terraform"

  }
}

resource "aws_subnet" "public_subnet_1" {
  vpc_id            = aws_vpc.expense_tracker_vpc.id
  cidr_block        = var.public_subnet_1_cdir_block
  availability_zone = var.availability_zones[0]
  tags = {
    Name                     = "expense_tracker_public_subnet_1"
    managed_by               = "terraform"
    "kubernetes.io/role/elb" = "1"

  }
}

resource "aws_subnet" "public_subnet_2" {
  vpc_id            = aws_vpc.expense_tracker_vpc.id
  cidr_block        = var.public_subnet_2_cdir_block
  availability_zone = var.availability_zones[1]
  tags = {
    Name                     = "expense_tracker_public_subnet_2"
    managed_by               = "terraform"
    "kubernetes.io/role/elb" = "1"
  }
}

resource "aws_subnet" "private_subnet_1" {
  vpc_id            = aws_vpc.expense_tracker_vpc.id
  cidr_block        = var.private_subnet_1_cdir_block
  availability_zone = var.availability_zones[0]
  tags = {
    Name                              = "expense_tracker_private_subnet_1"
    managed_by                        = "terraform"
    "kubernetes.io/role/internal-elb" = "1"
  }
}

resource "aws_subnet" "private_subnet_2" {
  vpc_id            = aws_vpc.expense_tracker_vpc.id
  cidr_block        = var.private_subnet_2_cdir_block
  availability_zone = var.availability_zones[1]
  tags = {
    Name                              = "expense_tracker_private_subnet_2"
    managed_by                        = "terraform"
    "kubernetes.io/role/internal-elb" = "1"
  }
}

resource "aws_internet_gateway" "expense_tracker_igw" {
  vpc_id = aws_vpc.expense_tracker_vpc.id
  tags = {
    Name       = "expense_tracker_igw"
    managed_by = "terraform"
  }
}



resource "aws_route_table" "expense_tracker_route_table" {
  vpc_id = aws_vpc.expense_tracker_vpc.id
  route {
    cidr_block = var.route_table_cdir_block
    gateway_id = aws_internet_gateway.expense_tracker_igw.id
  }
}

resource "aws_route_table_association" "public_subnet_1_association" {
  subnet_id      = aws_subnet.public_subnet_1.id
  route_table_id = aws_route_table.expense_tracker_route_table.id
}

resource "aws_route_table_association" "public_subnet_2_association" {
  subnet_id      = aws_subnet.public_subnet_2.id
  route_table_id = aws_route_table.expense_tracker_route_table.id
}

resource "aws_eip" "expense_tracker_nat_eip" {
  domain = "vpc"
  tags = {
    Name       = "expense_tracker_nat_eip"
    managed_by = "terraform"
  }
}

resource "aws_nat_gateway" "expense_tracker_nat_gw" {
  subnet_id     = aws_subnet.public_subnet_1.id
  allocation_id = aws_eip.expense_tracker_nat_eip.id
  tags = {
    Name       = "expense_tracker_nat_gw"
    managed_by = "terraform"
  }

  depends_on = [aws_internet_gateway.expense_tracker_igw]
}

resource "aws_route_table" "private_route_table" {
  vpc_id = aws_vpc.expense_tracker_vpc.id
  route {
    cidr_block     = var.private_route_table_cdir_block
    nat_gateway_id = aws_nat_gateway.expense_tracker_nat_gw.id
  }
  tags = {
    Name       = "expense_tracker_private_route_table"
    managed_by = "terraform"
  }
}

resource "aws_route_table_association" "private_subnet_1_association" {
  subnet_id      = aws_subnet.private_subnet_1.id
  route_table_id = aws_route_table.private_route_table.id
}

resource "aws_route_table_association" "private_subnet_2_association" {
  subnet_id      = aws_subnet.private_subnet_2.id
  route_table_id = aws_route_table.private_route_table.id
}


